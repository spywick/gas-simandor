/**
 * ============================================================================
 * PegawaiService.gs - Pengelolaan Data Master Pegawai di Sheet MASTER_PEGAWAI
 * ============================================================================
 * Helper bersama (lock, pencarian baris, cek referensi) ada di SheetRepo.gs.
 */

/** Tabel lain yang memakai ID_PEGAWAI sebagai foreign key. */
var PEGAWAI_REFERENCES_ = [
  { sheet: 'MASTER_TIM_ANGGOTA', header: 'PEGAWAI_ID', label: 'Anggota Tim' }
];

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_PEGAWAI'.
 * Jika sheet belum ada, otomatis dibuatkan beserta header kolom lengkapnya.
 */
function getPegawaiSheet_() {
  return getOrCreateSheet_('MASTER_PEGAWAI', [
    'ID_PEGAWAI', 'NAMA_PEGAWAI', 'NIP_LAMA', 'NIP_BARU', 'GOL_RUANG',
    'JENIS_KELAMIN', 'TANGGAL_LAHIR', 'ALAMAT', 'JABATAN', 'NO_HP',
    'EMAIL_GMAIL', 'EMAIL_SATKER', 'STATUS', 'KATEGORI',
    'CREATED_AT', 'CREATED_BY', 'UPDATED_AT', 'UPDATED_BY'
  ]);
}

/**
 * 1. READ: Mengambil seluruh data pegawai dari sheet.
 */
function getPegawaiList_() {
  try {
    return readObjects_(getPegawaiSheet_(), ['TANGGAL_LAHIR']);
  } catch (error) {
    throw new Error("Gagal mengambil data pegawai: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan atau memperbarui data pegawai.
 */
function savePegawai_(formData) {
  try {
    return withLock_(function () {
      var sheet = getPegawaiSheet_();
      var headers = getHeaders_(sheet);

      var now = nowString_();
      var currentUser = Session.getActiveUser().getEmail() || "Admin";

      if (formData.ID_PEGAWAI) {
        // MODE UPDATE
        var rowIndex = findRowById_(sheet, 'ID_PEGAWAI', formData.ID_PEGAWAI);
        if (!rowIndex) {
          return { success: false, message: 'Data pegawai tidak ditemukan untuk diperbarui.' };
        }
        updateRow_(sheet, headers, rowIndex, formData,
          ['ID_PEGAWAI', 'CREATED_AT', 'CREATED_BY'],
          { UPDATED_AT: now, UPDATED_BY: currentUser });
        return { success: true, message: 'Data pegawai berhasil diperbarui!' };
      }

      // MODE CREATE
      var row = copyObject_(formData);
      row.ID_PEGAWAI = newId_('PGW');
      row.CREATED_AT = now;
      row.CREATED_BY = currentUser;
      row.UPDATED_AT = '';
      row.UPDATED_BY = '';
      appendObject_(sheet, headers, row);
      return { success: true, message: 'Pegawai baru berhasil ditambahkan!' };
    });
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus data pegawai berdasarkan ID_PEGAWAI.
 * Ditolak jika pegawai masih terdaftar sebagai Anggota Tim.
 */
function deletePegawai_(idPegawai) {
  try {
    return withLock_(function () {
      var sheet = getPegawaiSheet_();
      var rowIndex = findRowById_(sheet, 'ID_PEGAWAI', idPegawai);

      if (!rowIndex) {
        return { success: false, message: 'Data pegawai tidak ditemukan.' };
      }

      var used = findReferences_(idPegawai, PEGAWAI_REFERENCES_);
      if (used.length) {
        return { success: false, message: referenceMessage_('Pegawai ini', used) };
      }

      sheet.deleteRow(rowIndex);
      return { success: true, message: 'Data pegawai berhasil dihapus!' };
    });
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}
