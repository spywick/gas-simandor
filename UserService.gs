/**
 * ============================================================================
 * UserService.gs - Pengelolaan Data Master User di Sheet MASTER_USER
 * ============================================================================
 * Helper bersama (lock, pencarian baris, cek duplikat) ada di SheetRepo.gs.
 */

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_USER'.
 * Jika sheet belum ada, maka otomatis akan dibuatkan sheet baru beserta header kolomnya.
 */
function getUserSheet() {
  return getOrCreateSheet_('MASTER_USER', ['ID_USER', 'NAMA', 'EMAIL', 'PASSWORD', 'LEVEL', 'STATUS', 'CREATED_AT']);
}

/**
 * 1. READ: Mengambil seluruh data user dari sheet untuk ditampilkan ke frontend.
 * Mengembalikan array of objects.
 */
function getUsers() {
  try {
    return readObjects_(getUserSheet());
  } catch (error) {
    throw new Error("Gagal mengambil data user: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan data baru atau memperbarui data user yang sudah ada.
 * Validasi email unik (tidak peka huruf besar/kecil) dijalankan di dalam lock.
 */
function saveUser(formData) {
  try {
    return withLock_(function () {
      var sheet = getUserSheet();
      var headers = getHeaders_(sheet);
      var emailInput = String(formData.EMAIL || '').trim().toLowerCase();

      // --- VALIDASI EMAIL UNIK ---
      if (existsRow_(sheet, { EMAIL: emailInput }, {
        caseInsensitive: true,
        excludeIdHeader: 'ID_USER',
        excludeId: formData.ID_USER
      })) {
        return { success: false, message: 'Gagal: Email "' + formData.EMAIL + '" sudah terdaftar dalam sistem!' };
      }

      // --- PROSES SIMPAN / UPDATE ---
      if (formData.ID_USER) {
        var rowIndex = findRowById_(sheet, 'ID_USER', formData.ID_USER);
        if (!rowIndex) {
          return { success: false, message: 'User tidak ditemukan untuk diperbarui.' };
        }
        updateRow_(sheet, headers, rowIndex, formData, ['ID_USER', 'CREATED_AT']);
        return { success: true, message: 'Data user berhasil diperbarui!' };
      }

      var row = copyObject_(formData);
      row.ID_USER = newId_('USR');
      row.CREATED_AT = nowString_();
      appendObject_(sheet, headers, row);
      return { success: true, message: 'User baru berhasil ditambahkan!' };
    });
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus data user dari sheet berdasarkan ID_USER.
 */
function deleteUser(idUser) {
  try {
    return withLock_(function () {
      var sheet = getUserSheet();
      var rowIndex = findRowById_(sheet, 'ID_USER', idUser);

      if (rowIndex) {
        sheet.deleteRow(rowIndex);
        return { success: true, message: 'User berhasil dihapus!' };
      }
      return { success: false, message: 'Data user tidak ditemukan.' };
    });
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}
