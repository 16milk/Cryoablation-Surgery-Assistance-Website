// Install rotating, self-pruning logging BEFORE anything else logs, so all
// console output (including dependency noise) is captured and bounded.
const logger = require('./logger');
logger.install();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const {
  initDb,
  DICOM_DIR,
  upsertStudy,
  upsertSeries,
  upsertInstance,
  refreshStudyCounts,
  getAllStudies,
  getStudy,
  getSeriesForStudy,
  getInstancesForSeries,
  getInstance,
  getInstancesForStudy,
  deleteStudy,
  deleteSeries,
} = require('./db');

const {
  readDicomBuffer,
  datasetToQidoTags,
  getPatientStudyUid,
  extractStudyMeta,
  extractSeriesMeta,
  buildStudyQidoRow,
  buildSeriesQidoRow,
  saveDicomFile,
  extractPixelDataFrame,
  denaturalizeDataset,
  sanitizeQidoTags,
} = require('./dicomUtils');

// Parse a stored per-instance metadata blob and strip inline pixel data / null
// Values so older rows (saved before sanitization) don't crash the frontend's
// dcmjs naturalizeDataset.
function parseInstanceMetadata(metadataJson) {
  return sanitizeQidoTags(JSON.parse(metadataJson));
}

const PORT = process.env.PORT || 5100;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024 * 1024 } });

const db = initDb();
const app = express();

// Crash guards: a single malformed DICOM file, a parse failure deep inside a
// dependency, or a stray rejected promise must NOT take the whole server down
// (which previously left the frontend stuck with endless ECONNREFUSED). Log and
// keep serving instead.
process.on('uncaughtException', err => {
  console.error('[uncaughtException] server kept alive:', err);
});
process.on('unhandledRejection', reason => {
  console.error('[unhandledRejection] server kept alive:', reason);
});

app.use(cors());
app.use(express.raw({ type: '*/*', limit: '512mb' }));

function ingestDicomBuffer(buffer, options = {}) {
  const dataset = readDicomBuffer(buffer);

  if (!dataset.StudyInstanceUID || !dataset.SeriesInstanceUID || !dataset.SOPInstanceUID) {
    throw new Error('Missing required DICOM UIDs');
  }

  const targetStudyUID = String(options.targetStudyUID || '').trim();
  let preserveStudyMeta = false;

  if (targetStudyUID) {
    // Explicit target: force this instance into the chosen main-page entry even
    // if the file's PatientID/Name differs. If the entry already exists, keep
    // its patient metadata untouched (only add the new series/instances).
    dataset.StudyInstanceUID = targetStudyUID;
    preserveStudyMeta = Boolean(getStudy(db, targetStudyUID));
  } else {
    // Default: group every DICOM by patient by replacing the real
    // StudyInstanceUID with a stable patient-level UID, so all of a patient's
    // data (across studies and separate uploads over time) collapses into one
    // row on the main page.
    dataset.StudyInstanceUID = getPatientStudyUid(dataset);
  }

  const filePath = saveDicomFile(DICOM_DIR, dataset, buffer);
  const metadataJson = JSON.stringify(datasetToQidoTags(dataset));

  if (!preserveStudyMeta) {
    upsertStudy(db, extractStudyMeta(dataset));
  }
  upsertSeries(db, extractSeriesMeta(dataset));
  upsertInstance(db, {
    sopInstanceUID: dataset.SOPInstanceUID,
    studyInstanceUID: dataset.StudyInstanceUID,
    seriesInstanceUID: dataset.SeriesInstanceUID,
    filePath,
    metadataJson,
  });
  refreshStudyCounts(db, dataset.StudyInstanceUID);

  return dataset;
}

function parseMultipartRelated(req) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) {
    return [];
  }

  const boundary = boundaryMatch[1].replace(/"/g, '');
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
  const parts = [];
  const delimiter = Buffer.from(`--${boundary}`);

  let start = body.indexOf(delimiter) + delimiter.length;

  while (start < body.length) {
    const next = body.indexOf(delimiter, start);
    const partEnd = next === -1 ? body.length : next;
    const part = body.slice(start, partEnd);

    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers = part.slice(0, headerEnd).toString('utf8');
      const dataStart = headerEnd + 4;
      let dataEnd = part.length;
      if (part[dataEnd - 2] === 0x0d && part[dataEnd - 1] === 0x0a) {
        dataEnd -= 2;
      }
      const data = part.slice(dataStart, dataEnd);

      if (headers.includes('application/dicom') && data.length > 132) {
        parts.push(data);
      }
    }

    if (next === -1) break;
    start = next + delimiter.length;
    if (body[start] === 0x2d && body[start + 1] === 0x2d) break;
    if (body[start] === 0x0d && body[start + 1] === 0x0a) start += 2;
  }

  return parts;
}

// ── QIDO-RS ──────────────────────────────────────────────────────────────────

app.get('/dicomweb/studies', (req, res) => {
  try {
    const studies = getAllStudies(db);
    const result = studies.map(s => buildStudyQidoRow(s, s.num_instances));
    res.json(result);
  } catch (err) {
    console.error('QIDO studies error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/dicomweb/studies/:studyUID/series', (req, res) => {
  try {
    const series = getSeriesForStudy(db, req.params.studyUID);
    res.json(series.map(buildSeriesQidoRow));
  } catch (err) {
    console.error('QIDO series error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── WADO-RS metadata ─────────────────────────────────────────────────────────

app.get('/dicomweb/studies/:studyUID/series/:seriesUID/metadata', (req, res) => {
  try {
    const instances = getInstancesForSeries(db, req.params.studyUID, req.params.seriesUID);
    const metadata = instances.map(inst => parseInstanceMetadata(inst.metadata_json));
    res.set('Content-Type', 'application/dicom+json');
    res.json(metadata);
  } catch (err) {
    console.error('WADO series metadata error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/dicomweb/studies/:studyUID/metadata', (req, res) => {
  try {
    const series = getSeriesForStudy(db, req.params.studyUID);
    const allMetadata = [];

    for (const s of series) {
      const instances = getInstancesForSeries(db, req.params.studyUID, s.series_instance_uid);
      for (const inst of instances) {
        allMetadata.push(parseInstanceMetadata(inst.metadata_json));
      }
    }

    res.set('Content-Type', 'application/dicom+json');
    res.json(allMetadata);
  } catch (err) {
    console.error('WADO study metadata error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── WADO-RS retrieve ─────────────────────────────────────────────────────────

app.get('/dicomweb/studies/:studyUID/series/:seriesUID/instances/:instanceUID', (req, res) => {
  try {
    const inst = getInstance(
      db,
      req.params.studyUID,
      req.params.seriesUID,
      req.params.instanceUID
    );

    if (!inst) {
      return res.status(404).send('Instance not found');
    }

    res.set('Content-Type', 'application/dicom');
    res.sendFile(path.resolve(inst.file_path), err => {
      if (err && !res.headersSent) {
        console.error('WADO retrieve sendFile error:', err);
        res.status(500).send('Failed to read instance file');
      }
    });
  } catch (err) {
    console.error('WADO retrieve error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

app.get(
  '/dicomweb/studies/:studyUID/series/:seriesUID/instances/:instanceUID/frames/:frame',
  (req, res) => {
    try {
      const inst = getInstance(
        db,
        req.params.studyUID,
        req.params.seriesUID,
        req.params.instanceUID
      );

      if (!inst) {
        return res.status(404).send('Instance not found');
      }

      const fs = require('fs');
      const buffer = fs.readFileSync(inst.file_path);
      const pixelData = extractPixelDataFrame(buffer);

      if (!pixelData) {
        res.set('Content-Type', 'application/dicom');
        return res.send(buffer);
      }

      const boundary = 'medview_frame_boundary';
      res.set(
        'Content-Type',
        `multipart/related; type="application/octet-stream"; boundary=${boundary}`
      );

      const header = `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`;
      const footer = `\r\n--${boundary}--\r\n`;
      res.send(Buffer.concat([Buffer.from(header), pixelData, Buffer.from(footer)]));
    } catch (err) {
      console.error('WADO frame error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  }
);

// ── STOW-RS ──────────────────────────────────────────────────────────────────

app.post('/dicomweb/studies', (req, res) => {
  try {
    const contentType = req.headers['content-type'] || '';
    let buffers = [];

    if (contentType.includes('multipart/related')) {
      buffers = parseMultipartRelated(req);
    } else if (contentType.includes('application/dicom')) {
      buffers = [Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || [])];
    }

    if (buffers.length === 0) {
      return res.status(400).json({ error: 'No DICOM data received' });
    }

    const stored = [];
    for (const buf of buffers) {
      const dataset = ingestDicomBuffer(buf);
      stored.push({
        StudyInstanceUID: dataset.StudyInstanceUID,
        SeriesInstanceUID: dataset.SeriesInstanceUID,
        SOPInstanceUID: dataset.SOPInstanceUID,
      });
    }

    res.status(200).json({
      ReferencedSOPSequence: stored.map(d => ({
        ReferencedSOPClassUID: d.SOPClassUID,
        ReferencedSOPInstanceUID: d.SOPInstanceUID,
      })),
    });
  } catch (err) {
    console.error('STOW error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Simple REST upload (for custom UI) ───────────────────────────────────────

app.post('/api/upload', upload.array('files'), (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    for (const file of files) {
      const dataset = ingestDicomBuffer(file.buffer);
      results.push({
        studyInstanceUID: dataset.StudyInstanceUID,
        seriesInstanceUID: dataset.SeriesInstanceUID,
        sopInstanceUID: dataset.SOPInstanceUID,
        patientName: dataset.PatientName,
      });
    }

    res.json({ success: true, count: results.length, files: results });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add a single DICOM file to a specific existing main-page entry. The raw file
// bytes are sent as the request body (buffered by express.raw) and forced into
// the study identified by ?targetStudyUID=, regardless of the file's patient
// tags. Used by the per-row "add files" action on the study list.
app.post('/api/studies/:studyUID/instances', (req, res) => {
  try {
    const targetStudyUID = req.params.studyUID;
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
    if (!buffer.length) {
      return res.status(400).json({ error: 'No DICOM data received' });
    }

    const dataset = ingestDicomBuffer(buffer, { targetStudyUID });
    res.json({
      success: true,
      studyInstanceUID: dataset.StudyInstanceUID,
      seriesInstanceUID: dataset.SeriesInstanceUID,
      sopInstanceUID: dataset.SOPInstanceUID,
    });
  } catch (err) {
    console.error('Add-to-study upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Delete ───────────────────────────────────────────────────────────────────

// Best-effort removal of files on disk; never throws so DB stays consistent.
function removeFilesQuietly(instances, dirToRemove) {
  for (const inst of instances || []) {
    try {
      if (inst.file_path) {
        fs.rmSync(inst.file_path, { force: true });
      }
    } catch (err) {
      console.warn('removeFilesQuietly: failed to delete file', inst.file_path, err.message);
    }
  }
  if (dirToRemove) {
    try {
      fs.rmSync(dirToRemove, { recursive: true, force: true });
    } catch (err) {
      console.warn('removeFilesQuietly: failed to delete dir', dirToRemove, err.message);
    }
  }
}

// Delete a whole study (one main-page entry): DB rows + files on disk.
app.delete('/api/studies/:studyUID', (req, res) => {
  try {
    const studyUID = req.params.studyUID;
    if (!getStudy(db, studyUID)) {
      return res.status(404).json({ error: 'Study not found' });
    }
    const instances = getInstancesForStudy(db, studyUID);
    deleteStudy(db, studyUID);
    removeFilesQuietly(instances, path.join(DICOM_DIR, studyUID));
    res.json({ success: true, deletedInstances: instances.length });
  } catch (err) {
    console.error('Delete study error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a single series within a study (specific data inside a row).
app.delete('/api/studies/:studyUID/series/:seriesUID', (req, res) => {
  try {
    const { studyUID, seriesUID } = req.params;
    const instances = getInstancesForSeries(db, studyUID, seriesUID);
    if (instances.length === 0 && !getStudy(db, studyUID)) {
      return res.status(404).json({ error: 'Series not found' });
    }
    deleteSeries(db, studyUID, seriesUID);
    refreshStudyCounts(db, studyUID);
    removeFilesQuietly(instances, path.join(DICOM_DIR, studyUID, seriesUID));
    res.json({ success: true, deletedInstances: instances.length });
  } catch (err) {
    console.error('Delete series error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (_req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM studies').get();
    res.json({ status: 'ok', studies: count.c });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Observability for the rotating logger: current files, disk usage, and how
// much noisy output has been suppressed.
app.get('/api/logs/stats', (_req, res) => {
  try {
    res.json(logger.stats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Final safety net: any error thrown synchronously in a route (or passed to
// next) is converted to a 500 here instead of bubbling up and killing the
// process. Keeps the server reachable so the frontend never sees ECONNREFUSED.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[express error]', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`MedView DICOM server running at http://localhost:${PORT}`);
  console.log(`  DICOMweb: http://localhost:${PORT}/dicomweb`);
  console.log(`  Upload:   POST http://localhost:${PORT}/api/upload`);
  console.log(`  Storage:  ${DICOM_DIR}`);
});
