/**
 * ============================================================================
 * TimService.gs - Pengelolaan Data Master Tim di Sheet MASTER_TIM
 * ============================================================================
 */

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_TIM'.
 */
function getTimSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MASTER_TIM');
  
  if (!sheet) {
    sheet = ss.insertSheet('MASTER_TIM');
    sheet.appendRow(['ID_TIM', 'TAHUN_ID', 'NAMA_TIM', 'KETERANGAN', 'CREATED_AT']);
  }
  return sheet;
}

/**
 * 1. READ: Mengambil seluruh data tim (beserta relasi teks tahun jika diperlukan).
 */
function getTimList() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Ambil data Tim
    var timSheet = getTimSheet();
    var timData = timSheet.getDataRange().getValues();
    if (timData.length <= 1) return [];

    var timHeaders = timData[0];
    
    // Ambil data Tahun untuk mapping relasi (ID_TAHUN -> TAHUN)
    var tahunMap = {};
    var tahunSheet = ss.getSheetByName('MASTER_TAHUN');
    if (tahunSheet && tahunSheet.getLastRow() > 1) {
      var tahunData = tahunSheet.getDataRange().getValues();
      var tHeaders = tahunData[0];
      var idThnIdx = tHeaders.indexOf('ID_TAHUN');
      var thnIdx = tHeaders.indexOf('TAHUN');
      
      for (var t = 1; t < tahunData.length; t++) {
        tahunMap[tahunData[t][idThnIdx]] = tahunData[t][thnIdx];
      }
    }

    var result = [];
    for (var i = 1; i < timData.length; i++) {
      var row = timData[i];
      var obj = {};
      
      timHeaders.forEach(function(header, index) {
        if (header === 'CREATED_AT' && row[index] instanceof Date) {
          obj[header] = Utilities.formatDate(row[index], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        } else {
          obj[header] = row[index];
        }
      });
      
      // Tambahkan label tahun untuk kemudahan tampilan di frontend
      obj['TAHUN_LABEL'] = tahunMap[obj['TAHUN_ID']] || obj['TAHUN_ID'];
      
      result.push(obj);
    }
    return result;
  } catch (error) {
    throw new Error("Gagal mengambil data tim: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan atau memperbarui data tim.
 */
function saveTim(formData) {
  try {
    var sheet = getTimSheet();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var idColIndex = headers.indexOf('ID_TIM') + 1;

    if (formData.ID_TIM) {
      // MODE UPDATE
      var idFinder = sheet.createTextFinder(formData.ID_TIM);
      var idMatch = idFinder.findNext();
      
      if (idMatch) {
        var rowIndex = idMatch.getRow();
        headers.forEach(function(header, colIdx) {
          if (header !== 'ID_TIM' && header !== 'CREATED_AT') {
            sheet.getRange(rowIndex, colIdx + 1).setValue(formData[header] || '');
          }
        });
        return { success: true, message: 'Data tim berhasil diperbarui!' };
      } else {
        return { success: false, message: 'Data tim tidak ditemukan untuk diperbarui.' };
      }
    } else {
      // MODE CREATE
      var newId = 'TIM-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

      var newRow = headers.map(function(header) {
        if (header === 'ID_TIM') return newId;
        if (header === 'CREATED_AT') return now;
        return formData[header] || '';
      });

      sheet.appendRow(newRow);
      return { success: true, message: 'Tim kerja baru berhasil ditambahkan!' };
    }
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus data tim berdasarkan ID_TIM.
 */
function deleteTim(idTim) {
  try {
    var sheet = getTimSheet();
    var finder = sheet.createTextFinder(idTim);
    var match = finder.findNext();

    if (match) {
      sheet.deleteRow(match.getRow());
      return { success: true, message: 'Data tim berhasil dihapus!' };
    }
    return { success: false, message: 'Data tim tidak ditemukan.' };
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}