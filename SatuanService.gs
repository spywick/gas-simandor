/**
 * ============================================================================
 * SatuanService.gs - Pengelolaan Data Master Satuan di Sheet MASTER_SATUAN
 * ============================================================================
 * Helper bersama (lock, pencarian baris, cek duplikat) ada di SheetRepo.gs.
 */

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_SATUAN'.
 * Jika sheet belum ada, otomatis dibuatkan beserta header kolomnya.
 */
function getSatuanSheet() {
  return getOrCreateSheet_('MASTER_SATUAN', ['ID_SATUAN', 'NAMA_SATUAN', 'KETERANGAN', 'CREATED_AT']);
}

/**
 * 1. READ: Mengambil seluruh data satuan dari sheet.
 */
function getSatuanList() {
  try {
    return readObjects_(getSatuanSheet());
  } catch (error) {
    throw new Error("Gagal mengambil data satuan: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan atau memperbarui data satuan (dengan validasi nama unik).
 */
function saveSatuan(formData) {
  try {
    return withLock_(function () {
      var sheet = getSatuanSheet();
      var headers = getHeaders_(sheet);

      // Validasi duplikasi nama satuan (tidak peka huruf besar/kecil)
      if (existsRow_(sheet, { NAMA_SATUAN: formData.NAMA_SATUAN }, {
        caseInsensitive: true,
        excludeIdHeader: 'ID_SATUAN',
        excludeId: formData.ID_SATUAN
      })) {
        return { success: false, message: 'Gagal: Nama satuan "' + formData.NAMA_SATUAN + '" sudah terdaftar dalam sistem!' };
      }

      if (formData.ID_SATUAN) {
        // MODE UPDATE
        var rowIndex = findRowById_(sheet, 'ID_SATUAN', formData.ID_SATUAN);
        if (!rowIndex) {
          return { success: false, message: 'Data satuan tidak ditemukan untuk diperbarui.' };
        }
        updateRow_(sheet, headers, rowIndex, formData, ['ID_SATUAN', 'CREATED_AT']);
        return { success: true, message: 'Data satuan berhasil diperbarui!' };
      }

      // MODE CREATE
      var row = copyObject_(formData);
      row.ID_SATUAN = newId_('STN');
      row.CREATED_AT = nowString_();
      appendObject_(sheet, headers, row);
      return { success: true, message: 'Satuan baru berhasil ditambahkan!' };
    });
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus data satuan berdasarkan ID_SATUAN.
 * (Belum ada tabel yang mereferensikan satuan. Tambahkan pengecekan referensi
 *  di sini begitu tabel honor/kegiatan memakai ID_SATUAN.)
 */
function deleteSatuan(idSatuan) {
  try {
    return withLock_(function () {
      var sheet = getSatuanSheet();
      var rowIndex = findRowById_(sheet, 'ID_SATUAN', idSatuan);

      if (rowIndex) {
        sheet.deleteRow(rowIndex);
        return { success: true, message: 'Data satuan berhasil dihapus!' };
      }
      return { success: false, message: 'Data satuan tidak ditemukan.' };
    });
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}
