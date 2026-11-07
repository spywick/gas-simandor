/**
 * ============================================================================
 * SatuanService.gs - Pengelolaan Data Master Satuan di Sheet MASTER_SATUAN
 * ============================================================================
 */

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_SATUAN'.
 * Jika sheet belum ada, otomatis dibuatkan beserta header kolomnya.
 */
function getSatuanSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MASTER_SATUAN');
  
  if (!sheet) {
    sheet = ss.insertSheet('MASTER_SATUAN');
    sheet.appendRow(['ID_SATUAN', 'NAMA_SATUAN', 'KETERANGAN', 'CREATED_AT']);
  }
  return sheet;
}

/**
 * 1. READ: Mengambil seluruh data satuan dari sheet.
 */
function getSatuanList() {
  try {
    var sheet = getSatuanSheet();
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
    throw new Error("Gagal mengambil data satuan: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan atau memperbarui data satuan (dengan validasi nama unik).
 */
function saveSatuan(formData) {
  try {
    var sheet = getSatuanSheet();
    var namaInput = String(formData.NAMA_SATUAN).trim();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var namaColIndex = headers.indexOf('NAMA_SATUAN') + 1;
    var idColIndex = headers.indexOf('ID_SATUAN') + 1;

    // Validasi duplikasi nama satuan menggunakan TextFinder
    if (namaColIndex > 0) {
      var columnRange = sheet.getRange(2, namaColIndex, Math.max(sheet.getLastRow() - 1, 1), 1);
      var finder = columnRange.createTextFinder(namaInput);
      finder.matchEntireCell(true);
      
      var match = finder.findNext();
      if (match) {
        var matchedRow = match.getRow();
        var existingId = sheet.getRange(matchedRow, idColIndex).getValue();

        if (!formData.ID_SATUAN || existingId != formData.ID_SATUAN) {
          return { success: false, message: 'Gagal: Nama satuan "' + formData.NAMA_SATUAN + '" sudah terdaftar dalam sistem!' };
        }
      }
    }

    // Proses Update atau Create
    if (formData.ID_SATUAN) {
      // MODE UPDATE
      var idFinder = sheet.createTextFinder(formData.ID_SATUAN);
      var idMatch = idFinder.findNext();
      
      if (idMatch) {
        var rowIndex = idMatch.getRow();
        headers.forEach(function(header, colIdx) {
          if (header !== 'ID_SATUAN' && header !== 'CREATED_AT') {
            sheet.getRange(rowIndex, colIdx + 1).setValue(formData[header] || '');
          }
        });
        return { success: true, message: 'Data satuan berhasil diperbarui!' };
      } else {
        return { success: false, message: 'Data satuan tidak ditemukan untuk diperbarui.' };
      }
    } else {
      // MODE CREATE
      var newId = 'STN-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

      var newRow = headers.map(function(header) {
        if (header === 'ID_SATUAN') return newId;
        if (header === 'CREATED_AT') return now;
        return formData[header] || '';
      });

      sheet.appendRow(newRow);
      return { success: true, message: 'Satuan baru berhasil ditambahkan!' };
    }
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus data satuan berdasarkan ID_SATUAN.
 */
function deleteSatuan(idSatuan) {
  try {
    var sheet = getSatuanSheet();
    var finder = sheet.createTextFinder(idSatuan);
    var match = finder.findNext();

    if (match) {
      sheet.deleteRow(match.getRow());
      return { success: true, message: 'Data satuan berhasil dihapus!' };
    }
    return { success: false, message: 'Data satuan tidak ditemukan.' };
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}