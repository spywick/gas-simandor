/**
 * ============================================================================
 * TimService.gs - Pengelolaan Data Master Tim di Sheet MASTER_TIM
 * ============================================================================
 * Helper bersama (lock, pencarian baris, cek referensi) ada di SheetRepo.gs.
 */

/** Tabel lain yang memakai ID_TIM sebagai foreign key. */
var TIM_REFERENCES_ = [
  { sheet: 'MASTER_TIM_ANGGOTA', header: 'TIM_ID', label: 'Anggota Tim' },
  { sheet: 'MASTER_KEGIATAN',    header: 'TIM_ID', label: 'Kegiatan' }
];

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_TIM'.
 */
function getTimSheet() {
  return getOrCreateSheet_('MASTER_TIM', ['ID_TIM', 'TAHUN_ID', 'NAMA_TIM', 'KETERANGAN', 'CREATED_AT']);
}

/**
 * 1. READ: Mengambil seluruh data tim (beserta relasi teks tahun jika diperlukan).
 */
function getTimList() {
  try {
    var list = readObjects_(getTimSheet());
    if (!list.length) return [];

    // Mapping relasi (ID_TAHUN -> TAHUN)
    var tahunMap = lookupMap_('MASTER_TAHUN', 'ID_TAHUN', 'TAHUN');

    list.forEach(function (obj) {
      // Tambahkan label tahun untuk kemudahan tampilan di frontend
      obj['TAHUN_LABEL'] = tahunMap[obj['TAHUN_ID']] || obj['TAHUN_ID'];
    });
    return list;
  } catch (error) {
    throw new Error("Gagal mengambil data tim: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan atau memperbarui data tim.
 */
function saveTim(formData) {
  try {
    return withLock_(function () {
      var sheet = getTimSheet();
      var headers = getHeaders_(sheet);

      if (formData.ID_TIM) {
        // MODE UPDATE
        var rowIndex = findRowById_(sheet, 'ID_TIM', formData.ID_TIM);
        if (!rowIndex) {
          return { success: false, message: 'Data tim tidak ditemukan untuk diperbarui.' };
        }
        updateRow_(sheet, headers, rowIndex, formData, ['ID_TIM', 'CREATED_AT']);
        return { success: true, message: 'Data tim berhasil diperbarui!' };
      }

      // MODE CREATE
      var row = copyObject_(formData);
      row.ID_TIM = newId_('TIM');
      row.CREATED_AT = nowString_();
      appendObject_(sheet, headers, row);
      return { success: true, message: 'Tim kerja baru berhasil ditambahkan!' };
    });
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus data tim berdasarkan ID_TIM.
 * Ditolak jika tim masih dipakai Anggota Tim atau Kegiatan.
 */
function deleteTim(idTim) {
  try {
    return withLock_(function () {
      var sheet = getTimSheet();
      var rowIndex = findRowById_(sheet, 'ID_TIM', idTim);

      if (!rowIndex) {
        return { success: false, message: 'Data tim tidak ditemukan.' };
      }

      var used = findReferences_(idTim, TIM_REFERENCES_);
      if (used.length) {
        return { success: false, message: referenceMessage_('Tim ini', used) };
      }

      sheet.deleteRow(rowIndex);
      return { success: true, message: 'Data tim berhasil dihapus!' };
    });
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}
