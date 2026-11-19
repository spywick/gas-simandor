/**
 * ============================================================================
 * TahunService.gs - Pengelolaan Data Master Tahun di Sheet MASTER_TAHUN
 * ============================================================================
 */

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_USER'.
 * Jika sheet belum ada, otomatis dibuatkan beserta 4 kolom utamanya.
 */
function getTahunSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MASTER_TAHUN');
  
  if (!sheet) {
    sheet = ss.insertSheet('MASTER_TAHUN');
    sheet.appendRow(['ID_TAHUN', 'TAHUN', 'KETERANGAN', 'CREATED_AT']);
  }
  return sheet;
}

/**
 * 1. READ: Mengambil seluruh data tahun dari sheet.
 */
function getTahunList() {
  try {
    var sheet = getTahunSheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return [];

    var headers = data[0];
    var result = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var obj = {};
      
      headers.forEach(function(header, index) {
        if (header === 'CREATED_AT' && row[index] instanceof Date) {
          obj[header] = Utilities.formatDate(row[index], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        } else {
          obj[header] = row[index];
        }
      });
      result.push(obj);
    }
    return result;
  } catch (error) {
    throw new Error("Gagal mengambil data tahun: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan atau memperbarui data tahun (dengan validasi unik).
 */
function saveTahun(formData) {
  try {
    var sheet = getTahunSheet();
    var tahunInput = String(formData.TAHUN).trim();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var tahunColIndex = headers.indexOf('TAHUN') + 1;
    var idColIndex = headers.indexOf('ID_TAHUN') + 1;

    // Validasi duplikasi tahun menggunakan TextFinder
    if (tahunColIndex > 0) {
      var tahunColumnRange = sheet.getRange(2, tahunColIndex, Math.max(sheet.getLastRow() - 1, 1), 1);
      var finder = tahunColumnRange.createTextFinder(tahunInput);
      finder.matchEntireCell(true);
      
      var match = finder.findNext();
      if (match) {
        var matchedRow = match.getRow();
        var existingId = sheet.getRange(matchedRow, idColIndex).getValue();

        if (!formData.ID_TAHUN || existingId != formData.ID_TAHUN) {
          return { success: false, message: 'Gagal: Tahun "' + formData.TAHUN + '" sudah terdaftar dalam sistem!' };
        }
      }
    }

    // Proses Update atau Create
    if (formData.ID_TAHUN) {
      // MODE UPDATE
      var idFinder = sheet.createTextFinder(formData.ID_TAHUN);
      var idMatch = idFinder.findNext();
      
      if (idMatch) {
        var rowIndex = idMatch.getRow();
        headers.forEach(function(header, colIdx) {
          if (header !== 'ID_TAHUN' && header !== 'CREATED_AT') {
            sheet.getRange(rowIndex, colIdx + 1).setValue(formData[header] || '');
          }
        });
        return { success: true, message: 'Data tahun berhasil diperbarui!' };
      } else {
        return { success: false, message: 'Data tahun tidak ditemukan untuk diperbarui.' };
      }
    } else {
      // MODE CREATE
      var newId = 'THN-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

      var newRow = headers.map(function(header) {
        if (header === 'ID_TAHUN') return newId;
        if (header === 'CREATED_AT') return now;
        return formData[header] || '';
      });

      sheet.appendRow(newRow);
      return { success: true, message: 'Tahun baru berhasil ditambahkan!' };
    }
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus data tahun berdasarkan ID_TAHUN.
 */
function deleteTahun(idTahun) {
  try {
    var sheet = getTahunSheet();
    var finder = sheet.createTextFinder(idTahun);
    var match = finder.findNext();

    if (match) {
      sheet.deleteRow(match.getRow());
      return { success: true, message: 'Data tahun berhasil dihapus!' };
    }
    return { success: false, message: 'Data tahun tidak ditemukan.' };
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}