const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'medview.db');
const DICOM_DIR = path.join(DATA_DIR, 'dicom');

function ensureDirs() {
  fs.mkdirSync(DICOM_DIR, { recursive: true });
}

function initDb() {
  ensureDirs();
  const db = new DatabaseSync(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS studies (
      study_instance_uid TEXT PRIMARY KEY,
      patient_name TEXT,
      patient_id TEXT,
      study_date TEXT,
      study_time TEXT,
      study_description TEXT,
      accession_number TEXT,
      modalities TEXT,
      num_instances INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS series (
      series_instance_uid TEXT PRIMARY KEY,
      study_instance_uid TEXT NOT NULL,
      series_number TEXT,
      series_description TEXT,
      modality TEXT,
      series_date TEXT,
      series_time TEXT,
      FOREIGN KEY (study_instance_uid) REFERENCES studies(study_instance_uid)
    );

    CREATE TABLE IF NOT EXISTS instances (
      sop_instance_uid TEXT PRIMARY KEY,
      study_instance_uid TEXT NOT NULL,
      series_instance_uid TEXT NOT NULL,
      file_path TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      FOREIGN KEY (study_instance_uid) REFERENCES studies(study_instance_uid),
      FOREIGN KEY (series_instance_uid) REFERENCES series(series_instance_uid)
    );

    CREATE INDEX IF NOT EXISTS idx_series_study ON series(study_instance_uid);
    CREATE INDEX IF NOT EXISTS idx_instances_series ON instances(series_instance_uid);
    CREATE INDEX IF NOT EXISTS idx_instances_study ON instances(study_instance_uid);
  `);

  return db;
}

function upsertStudy(db, meta) {
  db.prepare(`
    INSERT INTO studies (study_instance_uid, patient_name, patient_id, study_date, study_time,
      study_description, accession_number, modalities, num_instances)
    VALUES (@studyInstanceUID, @patientName, @patientId, @studyDate, @studyTime,
      @studyDescription, @accessionNumber, @modalities, @numInstances)
    ON CONFLICT(study_instance_uid) DO UPDATE SET
      patient_name = excluded.patient_name,
      patient_id = excluded.patient_id,
      study_date = CASE WHEN excluded.study_date >= study_date THEN excluded.study_date ELSE study_date END,
      study_time = CASE WHEN excluded.study_date >= study_date THEN excluded.study_time ELSE study_time END,
      study_description = CASE WHEN excluded.study_date >= study_date THEN excluded.study_description ELSE study_description END,
      accession_number = CASE WHEN excluded.study_date >= study_date THEN excluded.accession_number ELSE accession_number END
  `).run(meta);
}

function upsertSeries(db, meta) {
  db.prepare(`
    INSERT INTO series (series_instance_uid, study_instance_uid, series_number, series_description,
      modality, series_date, series_time)
    VALUES (@seriesInstanceUID, @studyInstanceUID, @seriesNumber, @seriesDescription,
      @modality, @seriesDate, @seriesTime)
    ON CONFLICT(series_instance_uid) DO UPDATE SET
      series_number = excluded.series_number,
      series_description = excluded.series_description,
      modality = excluded.modality,
      series_date = excluded.series_date,
      series_time = excluded.series_time
  `).run(meta);
}

function upsertInstance(db, meta) {
  db.prepare(`
    INSERT INTO instances (sop_instance_uid, study_instance_uid, series_instance_uid, file_path, metadata_json)
    VALUES (@sopInstanceUID, @studyInstanceUID, @seriesInstanceUID, @filePath, @metadataJson)
    ON CONFLICT(sop_instance_uid) DO UPDATE SET
      file_path = excluded.file_path,
      metadata_json = excluded.metadata_json
  `).run(meta);
}

function refreshStudyCounts(db, studyInstanceUID) {
  const row = db.prepare(`
    SELECT COUNT(*) as cnt, GROUP_CONCAT(DISTINCT s.modality) as mods
    FROM instances i
    JOIN series s ON s.series_instance_uid = i.series_instance_uid
    WHERE i.study_instance_uid = ?
  `).get(studyInstanceUID);

  db.prepare(`
    UPDATE studies SET num_instances = ?, modalities = ? WHERE study_instance_uid = ?
  `).run(row?.cnt || 0, row?.mods || '', studyInstanceUID);
}

function getAllStudies(db) {
  return db.prepare('SELECT * FROM studies ORDER BY study_date DESC, created_at DESC').all();
}

function getSeriesForStudy(db, studyInstanceUID) {
  return db.prepare('SELECT * FROM series WHERE study_instance_uid = ?').all(studyInstanceUID);
}

function getInstancesForSeries(db, studyInstanceUID, seriesInstanceUID) {
  return db.prepare(`
    SELECT * FROM instances
    WHERE study_instance_uid = ? AND series_instance_uid = ?
    ORDER BY sop_instance_uid
  `).all(studyInstanceUID, seriesInstanceUID);
}

function getInstance(db, studyInstanceUID, seriesInstanceUID, sopInstanceUID) {
  return db.prepare(`
    SELECT * FROM instances
    WHERE study_instance_uid = ? AND series_instance_uid = ? AND sop_instance_uid = ?
  `).get(studyInstanceUID, seriesInstanceUID, sopInstanceUID);
}

module.exports = {
  DATA_DIR,
  DICOM_DIR,
  initDb,
  upsertStudy,
  upsertSeries,
  upsertInstance,
  refreshStudyCounts,
  getAllStudies,
  getSeriesForStudy,
  getInstancesForSeries,
  getInstance,
};
