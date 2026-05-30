const fs = require('fs');
const path = require('path');
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

function datasetToQidoTags(dataset) {
  const denaturalized = denaturalizeDataset(dataset);
  const result = {};

  for (const [tag, value] of Object.entries(denaturalized)) {
    if (value && typeof value === 'object' && value.vr) {
      result[tag] = value;
    }
  }

  return result;
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

  const dicomDict = dcmjs.data.DicomMessage.readFile(arrayBuffer);
  const dataset = naturalizeDataset(dicomDict.dict);

  const rows = dataset.Rows || 0;
  const cols = dataset.Columns || 0;
  const bitsAllocated = dataset.BitsAllocated || 16;
  const pixelRepresentation = dataset.PixelRepresentation || 0;
  const numFrames = parseInt(dataset.NumberOfFrames || '1', 10);

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
  extractStudyMeta,
  extractSeriesMeta,
  buildStudyQidoRow,
  buildSeriesQidoRow,
  saveDicomFile,
  extractPixelDataFrame,
  naturalizeDataset,
  denaturalizeDataset,
};
