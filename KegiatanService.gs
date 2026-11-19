/**
 * ============================================================================
 * KegiatanService.gs - Pengelolaan Data Master Kegiatan di Sheet MASTER_KEGIATAN
 * ============================================================================
 */

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_KEGIATAN'.
 * Jika sheet belum ada, otomatis dibuatkan beserta header kolomnya.
 */
function getKegiatanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MASTER_KEGIATAN');
  
  if (!sheet) {
    sheet = ss.insertSheet('MASTER_KEGIATAN');
    sheet.appendRow(['ID_KEGIATAN', 'TAHUN_ID', 'TIM_ID', 'NAMA_KEGIATAN', 'SINGKATAN_KEGIATAN', 'CREATED_AT', 'CREATED_BY', 'UPDATED_AT', 'UPDATED_BY']);
  }
  return sheet;
}

/**
 * 1. READ: Mengambil seluruh data kegiatan dari sheet beserta mapping relasi teks Tahun & Tim.
 */
function getKegiatanList() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getKegiatanSheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return [];

    var headers = data[0];

    // Mapping Relasi Tahun (ID_TAHUN -> TAHUN)
    var tahunMap = {};
    var tahunSheet = ss.getSheetByName('MASTER_TAHUN');
    if (tahunSheet && tahunSheet.getLastRow() > 1) {
      var tData = tahunSheet.getDataRange().getValues();
      var tHeaders = tData[0];
      var idThnIdx = tHeaders.indexOf('ID_TAHUN');
      var thnIdx = tHeaders.indexOf('TAHUN');
      for (var t = 1; t < tData.length; t++) {
        tahunMap[tData[t][idThnIdx]] = tData[t][thnIdx];
      }
    }

    // Mapping Relasi Tim (ID_TIM -> NAMA_TIM)
    var timMap = {};
    var timSheet = ss.getSheetByName('MASTER_TIM');
    if (timSheet && timSheet.getLastRow() > 1) {
      var tmData = timSheet.getDataRange().getValues();
      var tmHeaders = tmData[0];
      var idTimIdx = tmHeaders.indexOf('ID_TIM');
      var namaTimIdx = tmHeaders.indexOf('NAMA_TIM');
      for (var tm = 1; tm < tmData.length; tm++) {
        timMap[tmData[tm][idTimIdx]] = tmData[tm][namaTimIdx];
      }
    }

    var result = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var obj = {};
      
      headers.forEach(function(header, index) {
        if ((header === 'CREATED_AT' || header === 'UPDATED_AT') && row[index] instanceof Date) {
          obj[header] = Utilities.formatDate(row[index], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        } else {
          obj[header] = row[index];
        }
      });

      // Menambahkan label Tahun dan Tim untuk kemudahan tampilan di Vue.js
      obj['TAHUN_LABEL'] = tahunMap[obj['TAHUN_ID']] || obj['TAHUN_ID'];
      obj['TIM_LABEL'] = timMap[obj['TIM_ID']] || obj['TIM_ID'];

      result.push(obj);
    }
    return result;
  } catch (error) {
    throw new Error("Gagal mengambil data kegiatan: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan atau memperbarui data kegiatan.
 */
function saveKegiatan(formData) {
  try {
    var sheet = getKegiatanSheet();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    if (formData.ID_KEGIATAN) {
      // MODE UPDATE: Mengisi kolom UPDATED_AT dan memperbarui data
      var idFinder = sheet.createTextFinder(formData.ID_KEGIATAN);
      var idMatch = idFinder.findNext();
      
      if (idMatch) {
        var rowIndex = idMatch.getRow();
        headers.forEach(function(header, colIdx) {
          if (header === 'UPDATED_AT') {
            sheet.getRange(rowIndex, colIdx + 1).setValue(now);
          } else if (header !== 'ID_KEGIATAN' && header !== 'CREATED_AT' && header !== 'CREATED_BY') {
            sheet.getRange(rowIndex, colIdx + 1).setValue(formData[header] || '');
          }
        });
        return { success: true, message: 'Data kegiatan berhasil diperbarui!' };
      } else {
        return { success: false, message: 'Data kegiatan tidak ditemukan.' };
      }
    } else {
      // MODE CREATE: Menambahkan kegiatan baru dengan ID unik (KGT-XXXXXXXX)
      var newId = 'KGT-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      var newRow = headers.map(function(header) {
        if (header === 'ID_KEGIATAN') return newId;
        if (header === 'CREATED_AT') return now;
        if (header === 'UPDATED_AT') return now;
        return formData[header] || '';
      });

      sheet.appendRow(newRow);
      return { success: true, message: 'Kegiatan baru berhasil ditambahkan!' };
    }
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus data kegiatan dari sheet berdasarkan ID_KEGIATAN.
 */
function deleteKegiatan(idKegiatan) {
  try {
    var sheet = getKegiatanSheet();
    var finder = sheet.createTextFinder(idKegiatan);
    var match = finder.findNext();

    if (match) {
      sheet.deleteRow(match.getRow());
      return { success: true, message: 'Data kegiatan berhasil dihapus!' };
    }
    return { success: false, message: 'Data kegiatan tidak ditemukan.' };
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}