/**
 * ============================================================================
 * PegawaiService.gs - Pengelolaan Data Master Pegawai di Sheet MASTER_PEGAWAI
 * ============================================================================
 */

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_PEGAWAI'.
 * Jika sheet belum ada, otomatis dibuatkan beserta header kolom lengkapnya.
 */
function getPegawaiSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MASTER_PEGAWAI');
  
  if (!sheet) {
    sheet = ss.insertSheet('MASTER_PEGAWAI');
    sheet.appendRow([
      'ID_PEGAWAI', 'NAMA_PEGAWAI', 'NIP_LAMA', 'NIP_BARU', 'GOL_RUANG', 
      'JENIS_KELAMIN', 'TANGGAL_LAHIR', 'ALAMAT', 'JABATAN', 'NO_HP', 
      'EMAIL_GMAIL', 'EMAIL_SATKER', 'STATUS', 'KATEGORI', 
      'CREATED_AT', 'CREATED_BY', 'UPDATED_AT', 'UPDATED_BY'
    ]);
  }
  return sheet;
}

/**
 * 1. READ: Mengambil seluruh data pegawai dari sheet.
 */
function getPegawaiList() {
  try {
    var sheet = getPegawaiSheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return [];

    var headers = data[0];
    var result = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var obj = {};
      
      headers.forEach(function(header, index) {
        if (header === 'TANGGAL_LAHIR' && row[index] instanceof Date) {
          obj[header] = Utilities.formatDate(row[index], Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else if ((header === 'CREATED_AT' || header === 'UPDATED_AT') && row[index] instanceof Date) {
          obj[header] = Utilities.formatDate(row[index], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        } else {
          obj[header] = row[index];
        }
      });
      result.push(obj);
    }
    return result;
  } catch (error) {
    throw new Error("Gagal mengambil data pegawai: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan atau memperbarui data pegawai.
 */
function savePegawai(formData) {
  try {
    var sheet = getPegawaiSheet();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    var currentUser = Session.getActiveUser().getEmail() || "Admin";

    // Proses Update atau Create
    if (formData.ID_PEGAWAI) {
      // MODE UPDATE
      var idFinder = sheet.createTextFinder(formData.ID_PEGAWAI);
      var idMatch = idFinder.findNext();
      
      if (idMatch) {
        var rowIndex = idMatch.getRow();
        
        headers.forEach(function(header, colIdx) {
          if (header !== 'ID_PEGAWAI' && header !== 'CREATED_AT' && header !== 'CREATED_BY') {
            if (header === 'UPDATED_AT') {
              sheet.getRange(rowIndex, colIdx + 1).setValue(now);
            } else if (header === 'UPDATED_BY') {
              sheet.getRange(rowIndex, colIdx + 1).setValue(currentUser);
            } else {
              sheet.getRange(rowIndex, colIdx + 1).setValue(formData[header] !== undefined ? formData[header] : '');
            }
          }
        });
        return { success: true, message: 'Data pegawai berhasil diperbarui!' };
      } else {
        return { success: false, message: 'Data pegawai tidak ditemukan untuk diperbarui.' };
      }
    } else {
      // MODE CREATE
      var newId = 'PGW-' + Utilities.getUuid().substring(0, 8).toUpperCase();

      var newRow = headers.map(function(header) {
        if (header === 'ID_PEGAWAI') return newId;
        if (header === 'CREATED_AT') return now;
        if (header === 'CREATED_BY') return currentUser;
        if (header === 'UPDATED_AT' || header === 'UPDATED_BY') return '';
        return formData[header] !== undefined ? formData[header] : '';
      });

      sheet.appendRow(newRow);
      return { success: true, message: 'Pegawai baru berhasil ditambahkan!' };
    }
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus data pegawai berdasarkan ID_PEGAWAI.
 */
function deletePegawai(idPegawai) {
  try {
    var sheet = getPegawaiSheet();
    var finder = sheet.createTextFinder(idPegawai);
    var match = finder.findNext();

    if (match) {
      sheet.deleteRow(match.getRow());
      return { success: true, message: 'Data pegawai berhasil dihapus!' };
    }
    return { success: false, message: 'Data pegawai tidak ditemukan.' };
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}