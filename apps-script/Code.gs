/**
 * QRNova Lab - Google Sheets & Docs bridge
 *
 * 1. Paste this entire file into script.google.com.
 * 2. Run setupProject() once and approve the requested permissions.
 * 3. Copy the WEB_API_TOKEN printed in the execution log.
 * 4. Deploy as a Web app:
 *      Execute as: Me
 *      Who has access: Anyone
 * 5. Copy the /exec URL and send it together with the token to the web developer.
 */

const APP_NAME = 'QRNova Lab';
const FOLDER_NAME = 'QRNova Lab Data';
const SPREADSHEET_NAME = 'QRNova Lab - Rekod Utama';

const SHEETS = {
  log: {
    name: 'Buku Log',
    headers: [
      'ID Rekod', 'Masa Dicipta', 'Tarikh', 'Nama', 'No. Matrik/Staf',
      'Masa Masuk', 'Makmal', 'Status Kehadiran', 'Aktiviti', 'Catatan'
    ]
  },
  asset: {
    name: 'KEW.PA-9',
    headers: [
      'ID Rekod', 'Masa Dicipta', 'Tarikh Dipinjam', 'Nama Pemohon',
      'Jawatan', 'Bahagian', 'Tujuan', 'Tempat Digunakan', 'Nama Pengeluar',
      'No. Siri Pendaftaran', 'Keterangan Aset', 'Tarikh Dijangka Pulang',
      'Catatan', 'Status', 'Pautan Google Doc'
    ]
  },
  mccb: {
    name: 'MCCB',
    headers: [
      'ID Rekod', 'Masa Dicipta', 'Tarikh Ujian', 'Test Ref. No.', 'Job No.',
      'Company', 'Brand', 'Model', 'Type', 'No. of Pole(s)',
      'Rated Current (A)', 'Short Circuit Capacity (kA)',
      'Ambient Temp. Mula (C)', 'Ambient Temp. Akhir (C)',
      'Humidity Mula (%)', 'Humidity Akhir (%)', 'TCD Factor',
      'Cable Size (mm2)', 'Tightening Torque (Nm)',
      'Test Current 1.05 x Ir (A)', 'Tripping Time 1.05 x Ir',
      'Test Current 1.30 x Ir (A)', 'Tripping Time 1.30 x Ir',
      'Keputusan', 'Remarks', 'Pautan Google Doc'
    ]
  }
};

/**
 * Run once from the Apps Script editor.
 * Creates the Drive folder, spreadsheet, tabs, and private API token.
 */
function setupProject() {
  const props = PropertiesService.getScriptProperties();
  let folder = getStoredFolder_();

  if (!folder) {
    folder = DriveApp.createFolder(FOLDER_NAME);
    props.setProperty('FOLDER_ID', folder.getId());
  }

  let spreadsheet = getStoredSpreadsheet_();
  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.create(SPREADSHEET_NAME);
    DriveApp.getFileById(spreadsheet.getId()).moveTo(folder);
    props.setProperty('SPREADSHEET_ID', spreadsheet.getId());
  }

  ensureSheets_(spreadsheet);

  let token = props.getProperty('WEB_API_TOKEN');
  if (!token) {
    token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('WEB_API_TOKEN', token);
  }

  const result = {
    success: true,
    folderUrl: folder.getUrl(),
    spreadsheetUrl: spreadsheet.getUrl(),
    token: token
  };

  console.log('SETUP SELESAI');
  console.log('WEB_API_TOKEN: ' + token);
  console.log('FOLDER: ' + folder.getUrl());
  console.log('SHEET: ' + spreadsheet.getUrl());
  return result;
}

/**
 * Simple health check. Open the deployed /exec URL in a browser.
 */
function doGet() {
  return jsonResponse_({
    success: true,
    service: APP_NAME,
    message: 'Google Sheets & Docs API aktif'
  });
}

/**
 * Accepts text/plain JSON to avoid browser CORS preflight.
 *
 * Request:
 * {
 *   "token": "...",
 *   "module": "log" | "asset" | "mccb",
 *   "data": { ...form fields... }
 * }
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Permintaan kosong.');
    }

    const request = JSON.parse(e.postData.contents);
    validateToken_(request.token);

    if (String(request.action || '').toLowerCase() === 'list') {
      return jsonResponse_({ success: true, records: listRecords_() });
    }

    const moduleName = String(request.module || '').toLowerCase();
    if (!SHEETS[moduleName]) {
      throw new Error('Modul tidak sah. Gunakan log, asset atau mccb.');
    }

    const data = request.data || {};
    const result = saveRecord_(moduleName, data);
    return jsonResponse_(result);
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      success: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function listRecords_() {
  const spreadsheet = getStoredSpreadsheet_();
  if (!spreadsheet) throw new Error('Jalankan setupProject() terlebih dahulu.');
  ensureSheets_(spreadsheet);
  const records = [];

  readDataRows_(spreadsheet.getSheetByName(SHEETS.log.name)).forEach(function(row) {
    records.push({
      id: String(row[0] || ''), module: 'log',
      title: String(row[6] || 'Buku Log'), subtitle: String(row[8] || row[3] || ''),
      status: String(row[7] || 'Hadir'), date: formatDate_(row[2]),
      createdAt: formatDateTime_(row[1]),
      data: {
        tarikh: formatDate_(row[2]), nama: String(row[3] || ''),
        no_id: String(row[4] || ''), masa_masuk: String(row[5] || ''),
        makmal: String(row[6] || ''), kehadiran: String(row[7] || ''),
        aktiviti: String(row[8] || ''), catatan: String(row[9] || ''),
        _syncStatus: 'synced'
      }
    });
  });

  readDataRows_(spreadsheet.getSheetByName(SHEETS.asset.name)).forEach(function(row) {
    records.push({
      id: String(row[0] || ''), module: 'asset',
      title: 'PA-9 • ' + String(row[10] || 'Aset'), subtitle: String(row[3] || ''),
      status: String(row[13] || 'Menunggu'), date: formatDate_(row[2]),
      createdAt: formatDateTime_(row[1]),
      data: {
        tarikh: formatDate_(row[2]), nama: String(row[3] || ''),
        jawatan: String(row[4] || ''), bahagian: String(row[5] || ''),
        tujuan: String(row[6] || ''), tempat: String(row[7] || ''),
        pengeluar: String(row[8] || ''), no_siri: String(row[9] || ''),
        aset: String(row[10] || ''), tarikh_pulang: formatDate_(row[11]),
        catatan: String(row[12] || ''), status: String(row[13] || ''),
        documentUrl: String(row[14] || ''), _syncStatus: 'synced'
      }
    });
  });

  readDataRows_(spreadsheet.getSheetByName(SHEETS.mccb.name)).forEach(function(row) {
    records.push({
      id: String(row[0] || ''), module: 'mccb',
      title: 'MCCB • ' + String(row[3] || 'Ujian'),
      subtitle: [row[6], row[7]].filter(String).join(' '),
      status: String(row[23] || 'Pending'), date: formatDate_(row[2]),
      createdAt: formatDateTime_(row[1]),
      data: {
        tarikh: formatDate_(row[2]), rujukan: String(row[3] || ''),
        job: String(row[4] || ''), syarikat: String(row[5] || ''),
        jenama: String(row[6] || ''), model: String(row[7] || ''),
        jenis: String(row[8] || ''), pole: String(row[9] || ''),
        arus_kadar: String(row[10] || ''), kapasiti: String(row[11] || ''),
        suhu_mula: String(row[12] || ''), suhu_akhir: String(row[13] || ''),
        lembapan_mula: String(row[14] || ''), lembapan_akhir: String(row[15] || ''),
        tcd: String(row[16] || ''), kabel: String(row[17] || ''),
        tork: String(row[18] || ''), arus_105: String(row[19] || ''),
        masa_105: String(row[20] || ''), arus_130: String(row[21] || ''),
        masa_130: String(row[22] || ''), keputusan: String(row[23] || ''),
        catatan: String(row[24] || ''), documentUrl: String(row[25] || ''),
        _syncStatus: 'synced'
      }
    });
  });

  return records.filter(function(record) { return record.id; }).sort(function(a, b) {
    return new Date(b.createdAt || b.date).getTime() -
      new Date(a.createdAt || a.date).getTime();
  });
}

function readDataRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn())
    .getValues().filter(function(row) { return String(row[0] || '').trim(); });
}

function formatDate_(value) {
  if (!value) return '';
  return Object.prototype.toString.call(value) === '[object Date]'
    ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd')
    : String(value);
}

function formatDateTime_(value) {
  if (!value) return '';
  return Object.prototype.toString.call(value) === '[object Date]'
    ? value.toISOString()
    : String(value);
}

function saveRecord_(moduleName, data) {
  const spreadsheet = getStoredSpreadsheet_();
  if (!spreadsheet) {
    throw new Error('Jalankan setupProject() terlebih dahulu.');
  }

  ensureSheets_(spreadsheet);
  const sheet = spreadsheet.getSheetByName(SHEETS[moduleName].name);
  const recordId = data.id || Utilities.getUuid();
  const createdAt = new Date();
  let documentResult = null;

  if (moduleName === 'asset') {
    documentResult = createKewPa9Doc_(recordId, data);
  } else if (moduleName === 'mccb') {
    documentResult = createMccbDoc_(recordId, data);
  }

  const rows = {
    log: [
      recordId, createdAt, value_(data.tarikh), value_(data.nama),
      value_(data.no_id), value_(data.masa_masuk), value_(data.makmal),
      value_(data.kehadiran), value_(data.aktiviti), value_(data.catatan)
    ],
    asset: [
      recordId, createdAt, value_(data.tarikh), value_(data.nama),
      value_(data.jawatan), value_(data.bahagian), value_(data.tujuan),
      value_(data.tempat), value_(data.pengeluar), value_(data.no_siri),
      value_(data.aset), value_(data.tarikh_pulang), value_(data.catatan),
      value_(data.status || 'Menunggu'),
      documentResult ? documentResult.url : ''
    ],
    mccb: [
      recordId, createdAt, value_(data.tarikh), value_(data.rujukan),
      value_(data.job), value_(data.syarikat), value_(data.jenama),
      value_(data.model), value_(data.jenis), value_(data.pole),
      value_(data.arus_kadar), value_(data.kapasiti), value_(data.suhu_mula),
      value_(data.suhu_akhir), value_(data.lembapan_mula),
      value_(data.lembapan_akhir), value_(data.tcd), value_(data.kabel),
      value_(data.tork), value_(data.arus_105), value_(data.masa_105),
      value_(data.arus_130), value_(data.masa_130),
      value_(data.keputusan), value_(data.catatan),
      documentResult ? documentResult.url : ''
    ]
  };

  sheet.appendRow(rows[moduleName]);
  SpreadsheetApp.flush();

  return {
    success: true,
    id: recordId,
    module: moduleName,
    spreadsheetUrl: spreadsheet.getUrl(),
    documentUrl: documentResult ? documentResult.url : null,
    message: documentResult
      ? 'Rekod disimpan dan Google Doc dijana.'
      : 'Rekod disimpan ke Google Sheet.'
  };
}

function createKewPa9Doc_(recordId, data) {
  const title = 'KEW.PA-9 - ' + value_(data.nama, 'Pemohon') + ' - ' + recordId.slice(0, 8);
  const doc = DocumentApp.create(title);
  moveFileToDataFolder_(doc.getId());
  const body = doc.getBody();

  addTitle_(body, 'KEW.PA-9');
  addSubtitle_(body, 'BORANG PERMOHONAN PERGERAKAN / PINJAMAN ASET ALIH');
  addKeyValueTable_(body, [
    ['No. Permohonan', recordId],
    ['Nama Pemohon', value_(data.nama)],
    ['Jawatan', value_(data.jawatan)],
    ['Bahagian', value_(data.bahagian)],
    ['Tujuan', value_(data.tujuan)],
    ['Tempat Digunakan', value_(data.tempat)],
    ['Nama Pengeluar', value_(data.pengeluar)]
  ]);

  body.appendParagraph('');
  addSectionHeading_(body, 'Butiran Aset');
  addKeyValueTable_(body, [
    ['No. Siri Pendaftaran', value_(data.no_siri)],
    ['Keterangan Aset', value_(data.aset)],
    ['Tarikh Dipinjam', value_(data.tarikh)],
    ['Tarikh Dijangka Pulang', value_(data.tarikh_pulang)],
    ['Status', value_(data.status || 'Menunggu')],
    ['Catatan', value_(data.catatan)]
  ]);

  body.appendParagraph('');
  addSignatureTable_(body, ['Peminjam', 'Pelulus', 'Pemulang', 'Penerima']);
  doc.saveAndClose();
  return { id: doc.getId(), url: doc.getUrl() };
}

function createMccbDoc_(recordId, data) {
  const title = 'MCCB Test Report - ' + value_(data.rujukan, recordId.slice(0, 8));
  const doc = DocumentApp.create(title);
  moveFileToDataFolder_(doc.getId());
  const body = doc.getBody();

  addTitle_(body, 'MCCB TEST REPORT');
  addSubtitle_(body, 'Test Data for Opening Under Overload Conditions');
  body.appendParagraph('MS IEC 60947-2').setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  addSectionHeading_(body, 'Detail of MCCB');
  addKeyValueTable_(body, [
    ['Test Ref. No.', value_(data.rujukan)],
    ['Job No.', value_(data.job)],
    ['Company', value_(data.syarikat)],
    ['Brand', value_(data.jenama)],
    ['Model', value_(data.model)],
    ['Type', value_(data.jenis)],
    ['No. of Pole(s)', value_(data.pole)],
    ['Rated Current (A)', value_(data.arus_kadar)],
    ['Rated Short Circuit Capacity (kA)', value_(data.kapasiti)]
  ]);

  addSectionHeading_(body, 'Working Condition');
  addKeyValueTable_(body, [
    ['Ambient Temperature Start (C)', value_(data.suhu_mula)],
    ['Ambient Temperature End (C)', value_(data.suhu_akhir)],
    ['Humidity Start (%)', value_(data.lembapan_mula)],
    ['Humidity End (%)', value_(data.lembapan_akhir)],
    ['TCD Factor', value_(data.tcd)],
    ['Cable Size (mm2)', value_(data.kabel)],
    ['Tightening Torque (Nm)', value_(data.tork)]
  ]);

  addSectionHeading_(body, 'Opening Under Overload Conditions');
  const testTable = body.appendTable([
    ['Test Setting', 'Test Current (A)', 'Tripping Time', 'Result'],
    ['1.05 x Ir', value_(data.arus_105), value_(data.masa_105), value_(data.keputusan)],
    ['1.30 x Ir', value_(data.arus_130), value_(data.masa_130), value_(data.keputusan)]
  ]);
  styleHeaderRow_(testTable);

  body.appendParagraph('');
  body.appendParagraph('Remarks: ' + value_(data.catatan, '-'));
  body.appendParagraph('Test Date: ' + value_(data.tarikh, '-'));
  body.appendParagraph('');
  addSignatureTable_(body, ['Tested By', 'Checked By', 'Approved By']);
  doc.saveAndClose();
  return { id: doc.getId(), url: doc.getUrl() };
}

function ensureSheets_(spreadsheet) {
  const expected = Object.keys(SHEETS);
  expected.forEach(function(key) {
    const config = SHEETS[key];
    let sheet = spreadsheet.getSheetByName(config.name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(config.name);
    }

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, config.headers.length)
        .setBackground('#173e31')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      sheet.autoResizeColumns(1, config.headers.length);
    }
  });

  const defaultSheet = spreadsheet.getSheetByName('Sheet1');
  if (defaultSheet && spreadsheet.getSheets().length > expected.length) {
    spreadsheet.deleteSheet(defaultSheet);
  }
}

function validateToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('WEB_API_TOKEN');
  if (!expected || !token || String(token) !== expected) {
    throw new Error('Token API tidak sah.');
  }
}

function getStoredFolder_() {
  const id = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!id) return null;
  try {
    return DriveApp.getFolderById(id);
  } catch (error) {
    return null;
  }
}

function getStoredSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) return null;
  try {
    return SpreadsheetApp.openById(id);
  } catch (error) {
    return null;
  }
}

function moveFileToDataFolder_(fileId) {
  const folder = getStoredFolder_();
  if (!folder) throw new Error('Folder data belum disediakan.');
  DriveApp.getFileById(fileId).moveTo(folder);
}

function addTitle_(body, text) {
  body.appendParagraph(text)
    .setHeading(DocumentApp.ParagraphHeading.TITLE)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
}

function addSubtitle_(body, text) {
  body.appendParagraph(text)
    .setBold(true)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('');
}

function addSectionHeading_(body, text) {
  body.appendParagraph(text)
    .setHeading(DocumentApp.ParagraphHeading.HEADING2)
    .setForegroundColor('#1f6d52');
}

function addKeyValueTable_(body, rows) {
  const table = body.appendTable(rows);
  for (let i = 0; i < table.getNumRows(); i++) {
    table.getRow(i).getCell(0).setBackgroundColor('#e7f2ec').setBold(true);
  }
  return table;
}

function addSignatureTable_(body, labels) {
  const firstRow = [];
  const secondRow = [];
  labels.forEach(function(label) {
    firstRow.push('\n\n____________________');
    secondRow.push(label + '\nNama:\nTarikh:');
  });
  const table = body.appendTable([firstRow, secondRow]);
  for (let i = 0; i < table.getNumRows(); i++) {
    for (let j = 0; j < table.getRow(i).getNumCells(); j++) {
      table.getRow(i).getCell(j).getChild(0)
        .asParagraph()
        .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    }
  }
}

function styleHeaderRow_(table) {
  for (let i = 0; i < table.getRow(0).getNumCells(); i++) {
    table.getRow(0).getCell(i)
      .setBackgroundColor('#173e31')
      .setForegroundColor('#ffffff')
      .setBold(true);
  }
}

function value_(value, fallback) {
  if (value === null || value === undefined || value === '') {
    return fallback || '';
  }
  return String(value);
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
