/**
 * ============================================================================
 * TahunService.gs - Pengelolaan Data Master Tahun di Sheet MASTER_TAHUN
 * ============================================================================
 * Helper bersama (lock, pencarian baris, cek duplikat/referensi) ada di SheetRepo.gs.
 */

/** Tabel lain yang memakai ID_TAHUN sebagai foreign key. */
var TAHUN_REFERENCES_ = [
  { sheet: 'MASTER_TIM',          header: 'TAHUN_ID', label: 'Tim' },
  { sheet: 'MASTER_TIM_ANGGOTA',  header: 'TAHUN_ID', label: 'Anggota Tim' },
  { sheet: 'MASTER_KEGIATAN',     header: 'TAHUN_ID', label: 'Kegiatan' }
];

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_TAHUN'.
 * Jika sheet belum ada, otomatis dibuatkan beserta 4 kolom utamanya.
 */
function getTahunSheet_() {
  return getOrCreateSheet_('MASTER_TAHUN', ['ID_TAHUN', 'TAHUN', 'KETERANGAN', 'CREATED_AT']);
}

/**
 * 1. READ: Mengambil seluruh data tahun dari sheet.
 */
function getTahunList_() {
  try {
    return readObjects_(getTahunSheet_());
  } catch (error) {
    throw new Error("Gagal mengambil data tahun: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan atau memperbarui data tahun (dengan validasi unik).
 */
function saveTahun_(formData) {
  try {
    return withLock_(function () {
      var sheet = getTahunSheet_();
      var headers = getHeaders_(sheet);

      // Validasi duplikasi tahun
      if (existsRow_(sheet, { TAHUN: formData.TAHUN }, {
        excludeIdHeader: 'ID_TAHUN',
        excludeId: formData.ID_TAHUN
      })) {
        return { success: false, message: 'Gagal: Tahun "' + formData.TAHUN + '" sudah terdaftar dalam sistem!' };
      }

      if (formData.ID_TAHUN) {
        // MODE UPDATE
        var rowIndex = findRowById_(sheet, 'ID_TAHUN', formData.ID_TAHUN);
        if (!rowIndex) {
          return { success: false, message: 'Data tahun tidak ditemukan untuk diperbarui.' };
        }
        updateRow_(sheet, headers, rowIndex, formData, ['ID_TAHUN', 'CREATED_AT']);
        return { success: true, message: 'Data tahun berhasil diperbarui!' };
      }

      // MODE CREATE
      var row = copyObject_(formData);
      row.ID_TAHUN = newId_('THN');
      row.CREATED_AT = nowString_();
      appendObject_(sheet, headers, row);
      return { success: true, message: 'Tahun baru berhasil ditambahkan!' };
    });
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus data tahun berdasarkan ID_TAHUN.
 * Ditolak jika tahun masih dipakai Tim, Anggota Tim, atau Kegiatan.
 */
function deleteTahun_(idTahun) {
  try {
    return withLock_(function () {
      var sheet = getTahunSheet_();
      var rowIndex = findRowById_(sheet, 'ID_TAHUN', idTahun);

      if (!rowIndex) {
        return { success: false, message: 'Data tahun tidak ditemukan.' };
      }

      var used = findReferences_(idTahun, TAHUN_REFERENCES_);
      if (used.length) {
        return { success: false, message: referenceMessage_('Tahun ini', used) };
      }

      sheet.deleteRow(rowIndex);
      return { success: true, message: 'Data tahun berhasil dihapus!' };
    });
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}