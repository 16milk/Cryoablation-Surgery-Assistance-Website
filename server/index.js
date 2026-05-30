const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

const {
  initDb,
  DICOM_DIR,
  upsertStudy,
  upsertSeries,
  upsertInstance,
  refreshStudyCounts,
  getAllStudies,
  getSeriesForStudy,
  getInstancesForSeries,
  getInstance,
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
} = require('./dicomUtils');

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

function ingestDicomBuffer(buffer) {
  const dataset = readDicomBuffer(buffer);

  if (!dataset.StudyInstanceUID || !dataset.SeriesInstanceUID || !dataset.SOPInstanceUID) {
    throw new Error('Missing required DICOM UIDs');
  }

  // Group every DICOM by patient: replace the real StudyInstanceUID with a
  // stable patient-level UID so all of a patient's data (across studies and
  // across separate uploads over time) collapses into one row on the main page.
  dataset.StudyInstanceUID = getPatientStudyUid(dataset);

  const filePath = saveDicomFile(DICOM_DIR, dataset, buffer);
  const metadataJson = JSON.stringify(datasetToQidoTags(dataset));

  upsertStudy(db, extractStudyMeta(dataset));
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
    const metadata = instances.map(inst => JSON.parse(inst.metadata_json));
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
        allMetadata.push(JSON.parse(inst.metadata_json));
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

app.get('/api/health', (_req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM studies').get();
    res.json({ status: 'ok', studies: count.c });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
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
