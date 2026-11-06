/**
 * ============================================================================
 * UserService.gs - Pengelolaan Data Master User di Sheet MASTER_USER
 * ============================================================================
 */

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_USER'.
 * Jika sheet belum ada, maka otomatis akan dibuatkan sheet baru beserta header kolomnya.
 */
function getUserSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MASTER_USER');
  
  if (!sheet) {
    sheet = ss.insertSheet('MASTER_USER');
    // Inisialisasi baris header pertama jika sheet baru dibuat
    sheet.appendRow(['ID_USER', 'NAMA', 'EMAIL', 'PASSWORD', 'LEVEL', 'STATUS', 'CREATED_AT']);
  }
  return sheet;
}

/**
 * 1. READ: Mengambil seluruh data user dari sheet untuk ditampilkan ke frontend.
 * Mengembalikan array of objects.
 */
function getUsers() {
  try {
    var sheet = getUserSheet();
    var data = sheet.getDataRange().getValues();
    
    // Jika data kosong atau hanya berisi baris header, kembalikan array kosong
    if (data.length <= 1) return [];

    var headers = data[0];
    var result = [];

    // Looping baris data (mulai dari baris ke-2 / index 1)
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var obj = {};
      
      headers.forEach(function(header, index) {
        // Konversi format tanggal Google Sheets ke string string standar agar aman dikirim ke Vue.js
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
    throw new Error("Gagal mengambil data user: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan data baru atau memperbarui data user yang sudah ada.
 * Dilengkapi validasi email unik menggunakan TextFinder agar proses pencarian cepat dan ringan.
 */
function saveUser(formData) {
  try {
    var sheet = getUserSheet();
    var emailInput = String(formData.EMAIL).trim().toLowerCase();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    var emailColIndex = headers.indexOf('EMAIL') + 1; // Indeks kolom email (1-indexed)
    var idColIndex = headers.indexOf('ID_USER') + 1;   // Indeks kolom ID user (1-indexed)

    // --- VALIDASI EMAIL UNIK MENGGUNAKAN TEXTFINDER ---
    // Cara ini jauh lebih ringan daripada meload seluruh array data ke memori server
    if (emailColIndex > 0) {
      var emailColumnRange = sheet.getRange(2, emailColIndex, Math.max(sheet.getLastRow() - 1, 1), 1);
      var finder = emailColumnRange.createTextFinder(emailInput);
      finder.matchEntireCell(true); // Mencari kecocokan isi sel secara utuh
      finder.matchCase(false);    // Tidak case-sensitive (huruf besar/kecil diabaikan)
      
      var match = finder.findNext();
      if (match) {
        var matchedRow = match.getRow();
        var existingId = sheet.getRange(matchedRow, idColIndex).getValue();

        // Jika email sudah dipakai baris lain dan bukan milik user yang sedang diedit, tolak!
        if (!formData.ID_USER || existingId != formData.ID_USER) {
          return { success: false, message: 'Gagal: Email "' + formData.EMAIL + '" sudah terdaftar dalam sistem!' };
        }
      }
    }

    // --- PROSES SIMPAN / UPDATE ---
    if (formData.ID_USER) {
      // MODE UPDATE: Mencari baris berdasarkan ID_USER yang dikirim dari form
      var idFinder = sheet.createTextFinder(formData.ID_USER);
      var idMatch = idFinder.findNext();
      
      if (idMatch) {
        var rowIndex = idMatch.getRow();
        // Update nilai setiap kolom kecuali ID_USER dan CREATED_AT
        headers.forEach(function(header, colIdx) {
          if (header !== 'ID_USER' && header !== 'CREATED_AT') {
            sheet.getRange(rowIndex, colIdx + 1).setValue(formData[header] || '');
          }
        });
        return { success: true, message: 'Data user berhasil diperbarui!' };
      } else {
        return { success: false, message: 'User tidak ditemukan untuk diperbarui.' };
      }
    } else {
      // MODE CREATE: Menambahkan user baru dengan ID unik dan timestamp saat ini
      var newId = 'USR-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

      // Memetakan data sesuai urutan kolom header pada spreadsheet
      var newRow = headers.map(function(header) {
        if (header === 'ID_USER') return newId;
        if (header === 'CREATED_AT') return now;
        return formData[header] || '';
      });

      sheet.appendRow(newRow);
      return { success: true, message: 'User baru berhasil ditambahkan!' };
    }
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus data user dari sheet berdasarkan ID_USER.
 * Menggunakan TextFinder untuk mencari baris secara cepat.
 */
function deleteUser(idUser) {
  try {
    var sheet = getUserSheet();
    var finder = sheet.createTextFinder(idUser);
    var match = finder.findNext();

    if (match) {
      // Hapus baris ditemukan pada spreadsheet
      sheet.deleteRow(match.getRow());
      return { success: true, message: 'User berhasil dihapus!' };
    }
    return { success: false, message: 'Data user tidak ditemukan.' };
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}