'use strict';

// Lightweight, dependency-free logging with built-in rotation so logs can never
// grow without bound and burden the disk/IO. It:
//   - routes all console.* output to a size-rotated file under data/logs/,
//   - enforces a hard ceiling of MAX_BYTES * MAX_FILES on disk,
//   - filters very chatty third-party noise (mostly dcmjs naturalization
//     warnings during bulk uploads) so it doesn't dominate the log,
//   - still mirrors output to the terminal for live dev,
//   - cleans up the legacy unbounded log left by older dev scripts.

const fs = require('fs');
const path = require('path');
const util = require('util');

const DATA_DIR = path.join(__dirname, 'data');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'server.log');
const LEGACY_LOG = path.join(DATA_DIR, 'server.log');

// Per-file cap and how many files to keep (current + rotated archives).
// Hard ceiling on disk = MAX_BYTES * MAX_FILES (default ~25 MB).
const MAX_BYTES = Number(process.env.LOG_MAX_BYTES) || 5 * 1024 * 1024;
const MAX_FILES = Math.max(1, Number(process.env.LOG_MAX_FILES) || 5);

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const LEVEL = LEVELS[String(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

// Messages matching these are dropped from the file (kept only as aggregate
// counts). They are high-volume and low-signal during bulk DICOM ingest.
const NOISE = [/Unknown name in dataset/i, /Invalid vr type/i, /No dictionary entry/i];

const original = {
  log: console.log.bind(console),
  info: (console.info || console.log).bind(console),
  warn: (console.warn || console.log).bind(console),
  error: (console.error || console.log).bind(console),
  debug: (console.debug || console.log).bind(console),
};

// Synchronous file-descriptor writes keep the on-disk size in lockstep with our
// counter, so rotation renames are always consistent (a buffered stream can
// leave bytes unflushed and make rotation race). Log volume here is low, so the
// blocking cost is negligible and the behavior is predictable.
let fd = null;
let currentSize = 0;
let totalSuppressed = 0;

function ensureFd() {
  if (fd !== null) return;
  fs.mkdirSync(LOG_DIR, { recursive: true });
  try {
    currentSize = fs.statSync(LOG_FILE).size;
  } catch {
    currentSize = 0;
  }
  fd = fs.openSync(LOG_FILE, 'a');
}

function closeFd() {
  if (fd !== null) {
    try {
      fs.closeSync(fd);
    } catch {
      /* ignore */
    }
    fd = null;
  }
}

function rotate() {
  closeFd();
  try {
    if (MAX_FILES <= 1) {
      if (fs.existsSync(LOG_FILE)) {
        fs.truncateSync(LOG_FILE, 0);
      }
    } else {
      const oldest = `${LOG_FILE}.${MAX_FILES - 1}`;
      if (fs.existsSync(oldest)) {
        fs.unlinkSync(oldest);
      }
      for (let i = MAX_FILES - 2; i >= 1; i--) {
        const src = `${LOG_FILE}.${i}`;
        if (fs.existsSync(src)) {
          fs.renameSync(src, `${LOG_FILE}.${i + 1}`);
        }
      }
      if (fs.existsSync(LOG_FILE)) {
        fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
      }
    }
  } catch (err) {
    original.error('[logger] rotate failed:', err.message);
  }
  currentSize = 0;
  ensureFd();
}

function writeToFile(line) {
  ensureFd();
  const buf = Buffer.from(line);
  // Rotate before writing if this line would exceed the cap, but never on an
  // empty file (avoids an infinite rotate loop on a single oversized line).
  if (currentSize > 0 && currentSize + buf.length > MAX_BYTES) {
    rotate();
  }
  try {
    fs.writeSync(fd, buf);
    currentSize += buf.length;
  } catch (err) {
    original.error('[logger] write failed:', err.message);
  }
}

function isNoise(msg) {
  return NOISE.some(re => re.test(msg));
}

function emit(level, origFn, args) {
  let msg;
  try {
    msg = util.format(...args);
  } catch {
    msg = args.map(String).join(' ');
  }

  if (isNoise(msg)) {
    totalSuppressed += 1;
    // Emit a throttled heartbeat so suppression is observable but cheap.
    if (totalSuppressed % 1000 === 0) {
      const note = `[logger] suppressed ${totalSuppressed} noisy log lines`;
      original.info(note);
      if (LEVELS.info <= LEVEL) {
        writeToFile(`${new Date().toISOString()} [INFO] ${note}\n`);
      }
    }
    return;
  }

  origFn(...args);
  if (LEVELS[level] <= LEVEL) {
    try {
      writeToFile(`${new Date().toISOString()} [${level.toUpperCase()}] ${msg}\n`);
    } catch (err) {
      original.error('[logger] failed to write log:', err.message);
    }
  }
}

function install() {
  // Drop the legacy unbounded log produced by older dev scripts (tee -a).
  try {
    if (fs.existsSync(LEGACY_LOG)) {
      fs.unlinkSync(LEGACY_LOG);
      original.info(`[logger] removed legacy log file ${LEGACY_LOG}`);
    }
  } catch {
    /* best effort */
  }

  console.log = (...a) => emit('info', original.log, a);
  console.info = (...a) => emit('info', original.info, a);
  console.warn = (...a) => emit('warn', original.warn, a);
  console.error = (...a) => emit('error', original.error, a);
  console.debug = (...a) => emit('debug', original.debug, a);
}

function stats() {
  let files = [];
  let totalBytes = 0;
  try {
    files = fs
      .readdirSync(LOG_DIR)
      .filter(f => f === 'server.log' || f.startsWith('server.log.'))
      .map(name => {
        let size = 0;
        try {
          size = fs.statSync(path.join(LOG_DIR, name)).size;
        } catch {
          /* ignore */
        }
        totalBytes += size;
        return { name, size };
      });
  } catch {
    /* ignore */
  }
  return {
    dir: LOG_DIR,
    level: Object.keys(LEVELS).find(k => LEVELS[k] === LEVEL),
    maxBytesPerFile: MAX_BYTES,
    maxFiles: MAX_FILES,
    hardCeilingBytes: MAX_BYTES * MAX_FILES,
    files,
    totalBytes,
    suppressedTotal: totalSuppressed,
  };
}

module.exports = { install, stats, LOG_DIR, LOG_FILE };
