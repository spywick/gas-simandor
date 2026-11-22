/**
 * ============================================================================
 * KegiatanService.gs - Pengelolaan Data Master Kegiatan di Sheet MASTER_KEGIATAN
 * ============================================================================
 * Helper bersama (lock, pencarian baris, cek referensi) ada di SheetRepo.gs.
 */

/**
 * Tabel lain yang memakai ID_KEGIATAN sebagai foreign key.
 * Daftarkan tabel baru di sini (mis. honor) agar kegiatan yang sudah dipakai
 * tidak bisa dihapus. Contoh:
 *   { sheet: 'HONOR_KEGIATAN', header: 'KEGIATAN_ID', label: 'Honor' }
 */
var KEGIATAN_REFERENCES_ = [];

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_KEGIATAN'.
 * Jika sheet belum ada, otomatis dibuatkan beserta header kolomnya.
 */
function getKegiatanSheet() {
  return getOrCreateSheet_('MASTER_KEGIATAN', [
    'ID_KEGIATAN', 'TAHUN_ID', 'TIM_ID', 'NAMA_KEGIATAN', 'SINGKATAN_KEGIATAN',
    'CREATED_AT', 'CREATED_BY', 'UPDATED_AT', 'UPDATED_BY'
  ]);
}

/**
 * 1. READ: Mengambil seluruh data kegiatan dari sheet beserta mapping relasi teks Tahun & Tim.
 */
function getKegiatanList() {
  try {
    var list = readObjects_(getKegiatanSheet());
    if (!list.length) return [];

    var tahunMap = lookupMap_('MASTER_TAHUN', 'ID_TAHUN', 'TAHUN');   // ID_TAHUN -> TAHUN
    var timMap = lookupMap_('MASTER_TIM', 'ID_TIM', 'NAMA_TIM');      // ID_TIM -> NAMA_TIM

    list.forEach(function (obj) {
      // Menambahkan label Tahun dan Tim untuk kemudahan tampilan di Vue.js
      obj['TAHUN_LABEL'] = tahunMap[obj['TAHUN_ID']] || obj['TAHUN_ID'];
      obj['TIM_LABEL'] = timMap[obj['TIM_ID']] || obj['TIM_ID'];
    });
    return list;
  } catch (error) {
    throw new Error("Gagal mengambil data kegiatan: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan atau memperbarui data kegiatan.
 * Validasi: nama kegiatan wajib, Tahun harus ada, dan Tim harus ada
 * serta merupakan tim milik tahun yang dipilih.
 */
function saveKegiatan(formData) {
  try {
    return withLock_(function () {
      var sheet = getKegiatanSheet();
      var headers = getHeaders_(sheet);
      var now = nowString_();
      var currentUser = Session.getActiveUser().getEmail() || "Admin";

      // --- VALIDASI ---
      if (!String(formData.NAMA_KEGIATAN || '').trim()) {
        return { success: false, message: 'Gagal: Nama kegiatan wajib diisi!' };
      }
      if (!existsRow_(getTahunSheet(), { ID_TAHUN: formData.TAHUN_ID })) {
        return { success: false, message: 'Gagal: Tahun yang dipilih tidak ditemukan!' };
      }
      // Satu pengecekan untuk dua hal: Tim ada, dan tim tersebut milik tahun yang dipilih
      if (!existsRow_(getTimSheet(), { ID_TIM: formData.TIM_ID, TAHUN_ID: formData.TAHUN_ID })) {
        return { success: false, message: 'Gagal: Tim tidak ditemukan atau bukan tim pada tahun yang dipilih!' };
      }

      if (formData.ID_KEGIATAN) {
        // MODE UPDATE: Mengisi kolom UPDATED_AT/UPDATED_BY dan memperbarui data
        var rowIndex = findRowById_(sheet, 'ID_KEGIATAN', formData.ID_KEGIATAN);
        if (!rowIndex) {
          return { success: false, message: 'Data kegiatan tidak ditemukan.' };
        }
        updateRow_(sheet, headers, rowIndex, formData,
          ['ID_KEGIATAN', 'CREATED_AT', 'CREATED_BY'],
          { UPDATED_AT: now, UPDATED_BY: currentUser });
        return { success: true, message: 'Data kegiatan berhasil diperbarui!' };
      }

      // MODE CREATE: Menambahkan kegiatan baru dengan ID unik (KGT-XXXXXXXX)
      var row = copyObject_(formData);
      row.ID_KEGIATAN = newId_('KGT');
      row.CREATED_AT = now;
      row.CREATED_BY = currentUser;
      row.UPDATED_AT = now;
      row.UPDATED_BY = currentUser;
      appendObject_(sheet, headers, row);
      return { success: true, message: 'Kegiatan baru berhasil ditambahkan!' };
    });
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus data kegiatan dari sheet berdasarkan ID_KEGIATAN.
 * Ditolak jika kegiatan masih dipakai tabel lain (lihat KEGIATAN_REFERENCES_).
 */
function deleteKegiatan(idKegiatan) {
  try {
    return withLock_(function () {
      var sheet = getKegiatanSheet();
      var rowIndex = findRowById_(sheet, 'ID_KEGIATAN', idKegiatan);

      if (!rowIndex) {
        return { success: false, message: 'Data kegiatan tidak ditemukan.' };
      }

      var used = findReferences_(idKegiatan, KEGIATAN_REFERENCES_);
      if (used.length) {
        return { success: false, message: referenceMessage_('Kegiatan ini', used) };
      }

      sheet.deleteRow(rowIndex);
      return { success: true, message: 'Data kegiatan berhasil dihapus!' };
    });
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}