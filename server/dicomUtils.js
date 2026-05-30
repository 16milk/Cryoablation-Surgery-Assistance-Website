const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dcmjs = require('dcmjs');

const { DicomMetaDictionary } = dcmjs.data;
const { naturalizeDataset, denaturalizeDataset, namifyDataset } = DicomMetaDictionary;

function readDicomBuffer(buffer) {
  let arrayBuffer = buffer;
  if (Buffer.isBuffer(buffer)) {
    arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  let dataset;
  try {
    const dicomDict = dcmjs.data.DicomMessage.readFile(arrayBuffer);
    dataset = naturalizeDataset(dicomDict.dict);
  } catch {
    const dicomDict = dcmjs.data.DicomMessage.readFile(arrayBuffer, { ignoreErrors: true });
    dataset = naturalizeDataset(dicomDict.dict);
  }

  return dataset;
}

// Tags whose value is bulk binary data that must NOT be inlined into the
// DICOMweb metadata. Pixel data is delivered separately via the frames
// endpoint; leaving it here both bloats the metadata and (because the bytes are
// not JSON-serializable) lands as `Value: null`, which crashes dcmjs
// naturalizeDataset on the frontend ("Cannot read properties of null").
const BULK_BINARY_TAGS = new Set([
  '7FE00010', // PixelData
  '7FE00009', // DoubleFloatPixelData
  '7FE00008', // FloatPixelData
  '00420011', // EncapsulatedDocument
]);

/**
 * Make a DICOM-JSON tag map safe for `naturalizeDataset`:
 *  - drop bulk binary tags (pixel data etc.),
 *  - recurse into sequences (SQ),
 *  - guarantee every element has an array `Value` (or a Bulk/Inline reference),
 *    never `null`/`undefined`, so dcmjs never reads `.length` of null.
 */
function sanitizeQidoTags(tags) {
  const result = {};

  for (const [tag, element] of Object.entries(tags || {})) {
    if (!element || typeof element !== 'object' || !element.vr) {
      continue;
    }
    if (BULK_BINARY_TAGS.has(tag)) {
      continue;
    }

    const clean = { vr: element.vr };

    if (element.vr === 'SQ') {
      const items = Array.isArray(element.Value) ? element.Value : [];
      clean.Value = items.filter(Boolean).map(item => sanitizeQidoTags(item));
    } else if (Array.isArray(element.Value)) {
      clean.Value = element.Value;
    } else if (element.BulkDataURI != null) {
      clean.BulkDataURI = element.BulkDataURI;
    } else if (element.InlineBinary != null) {
      clean.InlineBinary = element.InlineBinary;
    } else {
      clean.Value = [];
    }

    result[tag] = clean;
  }

  return result;
}

function datasetToQidoTags(dataset) {
  return sanitizeQidoTags(denaturalizeDataset(dataset));
}

function formatPatientName(name) {
  if (!name) return '';
  if (typeof name === 'string') return name;
  if (Array.isArray(name) && name[0]) {
    const pn = name[0];
    if (typeof pn === 'object') return pn.Alphabetic || pn.Ideographic || '';
    return String(pn);
  }
  if (typeof name === 'object') return name.Alphabetic || name.Ideographic || '';
  return String(name);
}

// Generate a stable, DICOM-valid UID that represents a single patient.
// Using the `2.25.<integer>` UUID-derived OID convention. The same patient key
// always produces the same UID, so every DICOM belonging to that patient is
// grouped under one "study" row on the main page, regardless of its real
// StudyInstanceUID or when it was uploaded.
function patientUidFromKey(key) {
  const hash = crypto.createHash('sha256').update(key).digest();
  let big = BigInt('0x' + hash.subarray(0, 14).toString('hex'));
  if (big === 0n) {
    big = 1n;
  }
  return '2.25.' + big.toString();
}

// Resolve the patient-level grouping UID for a dataset. Falls back to the real
// StudyInstanceUID when no patient identity is available (so nothing is lost).
function getPatientStudyUid(dataset) {
  const patientId = (dataset.PatientID || '').trim();
  const patientName = formatPatientName(dataset.PatientName).trim();
  const key = patientId || patientName;

  if (!key) {
    return dataset.StudyInstanceUID;
  }

  return patientUidFromKey(key);
}

function extractStudyMeta(dataset) {
  return {
    studyInstanceUID: dataset.StudyInstanceUID,
    patientName: formatPatientName(dataset.PatientName),
    patientId: dataset.PatientID || '',
    studyDate: dataset.StudyDate || '',
    studyTime: dataset.StudyTime || '',
    studyDescription: dataset.StudyDescription || '',
    accessionNumber: dataset.AccessionNumber || '',
    modalities: dataset.Modality || '',
    numInstances: 1,
  };
}

function extractSeriesMeta(dataset) {
  return {
    studyInstanceUID: dataset.StudyInstanceUID,
    seriesInstanceUID: dataset.SeriesInstanceUID,
    seriesNumber: String(dataset.SeriesNumber ?? ''),
    seriesDescription: dataset.SeriesDescription || '',
    modality: dataset.Modality || '',
    seriesDate: dataset.SeriesDate || '',
    seriesTime: dataset.SeriesTime || '',
  };
}

function buildStudyQidoRow(study, instanceCount) {
  const pn = study.patient_name || '';
  return {
    '0020000D': { vr: 'UI', Value: [study.study_instance_uid] },
    '00080020': { vr: 'DA', Value: study.study_date ? [study.study_date] : [] },
    '00080030': { vr: 'TM', Value: study.study_time ? [study.study_time] : [] },
    '00080050': { vr: 'SH', Value: study.accession_number ? [study.accession_number] : [] },
    '00100020': { vr: 'LO', Value: study.patient_id ? [study.patient_id] : [] },
    '00100010': { vr: 'PN', Value: pn ? [{ Alphabetic: pn }] : [] },
    '00201208': { vr: 'IS', Value: [String(instanceCount ?? study.num_instances ?? 0)] },
    '00081030': { vr: 'LO', Value: study.study_description ? [study.study_description] : [] },
    '00080060': { vr: 'CS', Value: study.modalities ? study.modalities.split(',') : [] },
    '00080061': { vr: 'CS', Value: study.modalities ? study.modalities.split(',') : [] },
  };
}

function buildSeriesQidoRow(series) {
  return {
    '0020000D': { vr: 'UI', Value: [series.study_instance_uid] },
    '0020000E': { vr: 'UI', Value: [series.series_instance_uid] },
    '00200011': { vr: 'IS', Value: series.series_number ? [series.series_number] : [] },
    '0008103E': { vr: 'LO', Value: series.series_description ? [series.series_description] : [] },
    '00080060': { vr: 'CS', Value: series.modality ? [series.modality] : [] },
    '00080021': { vr: 'DA', Value: series.series_date ? [series.series_date] : [] },
    '00080031': { vr: 'TM', Value: series.series_time ? [series.series_time] : [] },
  };
}

function saveDicomFile(dicomDir, dataset, buffer) {
  const studyUID = dataset.StudyInstanceUID;
  const seriesUID = dataset.SeriesInstanceUID;
  const sopUID = dataset.SOPInstanceUID;

  const dir = path.join(dicomDir, studyUID, seriesUID);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${sopUID}.dcm`);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

function extractPixelDataFrame(buffer) {
  const arrayBuffer = Buffer.isBuffer(buffer)
    ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
    : buffer;

  let dataset;
  try {
    const dicomDict = dcmjs.data.DicomMessage.readFile(arrayBuffer);
    dataset = naturalizeDataset(dicomDict.dict);
  } catch (err) {
    // Unparseable / unsupported transfer syntax: let the caller fall back to
    // returning the raw .dcm file rather than crashing the request.
    console.error('extractPixelDataFrame parse failed, falling back to raw file:', err.message);
    return null;
  }

  if (!dataset.PixelData) {
    return null;
  }

  let pixelData = dataset.PixelData;
  if (Array.isArray(pixelData)) {
    pixelData = pixelData[0];
  }

  if (pixelData instanceof ArrayBuffer) {
    return Buffer.from(pixelData);
  }
  if (Buffer.isBuffer(pixelData)) {
    return pixelData;
  }
  if (typeof pixelData === 'object' && pixelData.buffer) {
    return Buffer.from(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength);
  }

  return null;
}

module.exports = {
  readDicomBuffer,
  datasetToQidoTags,
  sanitizeQidoTags,
  getPatientStudyUid,
  extractStudyMeta,
  extractSeriesMeta,
  buildStudyQidoRow,
  buildSeriesQidoRow,
  saveDicomFile,
  extractPixelDataFrame,
  naturalizeDataset,
  denaturalizeDataset,
};
