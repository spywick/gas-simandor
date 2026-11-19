/**
 * ============================================================================
 * SheetRepo.gs - Helper bersama untuk seluruh *Service.gs
 * ============================================================================
 * Semua fungsi berakhiran "_" bersifat private di Google Apps Script, sehingga
 * TIDAK bisa dipanggil dari browser lewat google.script.run. Hanya fungsi
 * publik di *Service.gs yang terekspos ke frontend.
 */

var FORMAT_DATETIME_ = 'yyyy-MM-dd HH:mm:ss';
var FORMAT_DATE_ = 'yyyy-MM-dd';

/**
 * Menjalankan fn() di dalam LockService agar proses cek-lalu-tulis tidak
 * bertabrakan saat dua pengguna menyimpan/menghapus bersamaan.
 * Mengembalikan hasil fn(), atau { success: false } bila lock gagal didapat.
 */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (e) {
    return { success: false, message: 'Sistem sedang memproses permintaan lain. Silakan coba lagi beberapa saat.' };
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/** Mengambil sheet berdasarkan nama; jika belum ada dibuat beserta header-nya. */
function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

function newId_(prefix) {
  return prefix + '-' + Utilities.getUuid().substring(0, 8).toUpperCase();
}

function nowString_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), FORMAT_DATETIME_);
}

/** Date tidak bisa dikirim ke browser lewat google.script.run, jadi diubah ke string. */
function formatCell_(value, header, dateOnlyHeaders) {
  if (value instanceof Date) {
    var isDateOnly = dateOnlyHeaders && dateOnlyHeaders.indexOf(header) !== -1;
    return Utilities.formatDate(value, Session.getScriptTimeZone(), isDateOnly ? FORMAT_DATE_ : FORMAT_DATETIME_);
  }
  return value;
}

/**
 * Membaca seluruh baris data menjadi array of objects (kunci = nama header).
 * dateOnlyHeaders: daftar header bertipe tanggal saja (tanpa jam).
 */
function readObjects_(sheet, dateOnlyHeaders) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) return [];

  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = formatCell_(data[i][c], headers[c], dateOnlyHeaders);
    }
    result.push(obj);
  }
  return result;
}

/**
 * Membuat peta { nilaiId: nilaiLabel } dari sheet lain (untuk "virtual JOIN").
 * Mengembalikan objek kosong jika sheet belum ada / kosong.
 */
function lookupMap_(sheetName, idHeader, valueHeader) {
  var map = {};
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return map;

  var data = sheet.getDataRange().getValues();
  var idIdx = data[0].indexOf(idHeader);
  var valIdx = data[0].indexOf(valueHeader);
  if (idIdx === -1 || valIdx === -1) return map;

  for (var i = 1; i < data.length; i++) {
    map[data[i][idIdx]] = data[i][valIdx];
  }
  return map;
}

function normalize_(value, caseInsensitive) {
  var s = (value === undefined || value === null) ? '' : String(value).trim();
  return caseInsensitive ? s.toLowerCase() : s;
}

/**
 * Mencari nomor baris (1-based) berdasarkan nilai kolom ID secara PERSIS.
 * Berbeda dengan TextFinder tanpa matchEntireCell, fungsi ini tidak akan
 * cocok dengan sel lain yang kebetulan memuat teks yang sama.
 * Mengembalikan 0 jika tidak ditemukan atau id kosong.
 */
function findRowById_(sheet, idHeader, id) {
  var target = normalize_(id, false);
  if (target === '') return 0;

  var col = getHeaders_(sheet).indexOf(idHeader) + 1;
  var lastRow = sheet.getLastRow();
  if (col < 1 || lastRow < 2) return 0;

  var ids = sheet.getRange(2, col, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (normalize_(ids[i][0], false) === target) return i + 2;
  }
  return 0;
}

/**
 * Mengecek apakah sudah ada baris yang cocok dengan SEMUA kriteria.
 * criteria : { HEADER: nilai, ... }  (dibandingkan sebagai teks, tanpa spasi tepi)
 * opts     : { caseInsensitive, excludeIdHeader, excludeId } -> baris miliknya
 *            sendiri (saat edit) dikecualikan dari pengecekan.
 * Jika salah satu nilai kriteria kosong, hasilnya false (tidak dianggap duplikat).
 */
function existsRow_(sheet, criteria, opts) {
  opts = opts || {};
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return false;

  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0];
  var keys = Object.keys(criteria);

  var targets = [];
  for (var k = 0; k < keys.length; k++) {
    var idx = headers.indexOf(keys[k]);
    var target = normalize_(criteria[keys[k]], opts.caseInsensitive);
    if (idx === -1 || target === '') return false;
    targets.push({ idx: idx, value: target });
  }

  var excludeIdx = opts.excludeIdHeader ? headers.indexOf(opts.excludeIdHeader) : -1;
  var excludeId = normalize_(opts.excludeId, false);

  for (var r = 1; r < data.length; r++) {
    if (excludeIdx !== -1 && excludeId !== '' && normalize_(data[r][excludeIdx], false) === excludeId) continue;

    var allMatch = true;
    for (var t = 0; t < targets.length; t++) {
      if (normalize_(data[r][targets[t].idx], opts.caseInsensitive) !== targets[t].value) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return true;
  }
  return false;
}

/**
 * Mengecek apakah sebuah nilai (mis. ID_TAHUN) masih dipakai tabel lain.
 * refs: [{ sheet: 'MASTER_TIM', header: 'TAHUN_ID', label: 'Tim' }, ...]
 * Mengembalikan array label tabel yang masih memakainya (kosong = aman dihapus).
 */
function findReferences_(value, refs) {
  var target = normalize_(value, false);
  var used = [];
  if (target === '') return used;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var i = 0; i < refs.length; i++) {
    var sheet = ss.getSheetByName(refs[i].sheet);
    if (!sheet || sheet.getLastRow() < 2) continue;

    var col = getHeaders_(sheet).indexOf(refs[i].header) + 1;
    if (col < 1) continue;

    var values = sheet.getRange(2, col, sheet.getLastRow() - 1, 1).getValues();
    for (var r = 0; r < values.length; r++) {
      if (normalize_(values[r][0], false) === target) {
        used.push(refs[i].label);
        break;
      }
    }
  }
  return used;
}

/** Pesan standar saat data masih dipakai tabel lain. */
function referenceMessage_(entityLabel, usedLabels) {
  return 'Gagal: ' + entityLabel + ' masih dipakai pada data ' + usedLabels.join(', ') +
         '. Hapus atau ubah data tersebut terlebih dahulu.';
}

/** Mengubah objek menjadi array baris sesuai urutan header (undefined/null -> ''). */
function rowFromObject_(headers, obj) {
  return headers.map(function (header) {
    var v = obj[header];
    return (v === undefined || v === null) ? '' : v;
  });
}

function appendObject_(sheet, headers, obj) {
  sheet.appendRow(rowFromObject_(headers, obj));
}

/** Menambahkan banyak baris sekaligus dengan satu kali tulis. */
function appendObjects_(sheet, headers, objs) {
  if (!objs.length) return;
  var rows = objs.map(function (o) { return rowFromObject_(headers, o); });
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
}

/**
 * Memperbarui satu baris dengan SATU kali tulis (bukan setValue per sel).
 * - protectedHeaders : kolom yang tidak boleh diubah (ID, CREATED_AT, dst.)
 * - overrides        : { HEADER: nilai } nilai yang diisi sistem (UPDATED_AT, dst.)
 * - Kolom yang tidak dikirim form (undefined) dipertahankan nilai lamanya,
 *   tidak lagi dikosongkan.
 */
function updateRow_(sheet, headers, rowIndex, formData, protectedHeaders, overrides) {
  var range = sheet.getRange(rowIndex, 1, 1, headers.length);
  var current = range.getValues()[0];

  var next = headers.map(function (header, i) {
    if (overrides && Object.prototype.hasOwnProperty.call(overrides, header)) return overrides[header];
    if (protectedHeaders.indexOf(header) !== -1) return current[i];
    var v = formData[header];
    if (v === undefined) return current[i];
    return v === null ? '' : v;
  });

  range.setValues([next]);
}

/** Salinan dangkal objek (agar formData dari klien tidak dimodifikasi langsung). */
function copyObject_(obj) {
  var out = {};
  Object.keys(obj || {}).forEach(function (k) { out[k] = obj[k]; });
  return out;
}
