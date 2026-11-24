/**
 * ============================================================================
 * ApiRegistry.gs - Daftar fungsi yang boleh dipanggil frontend + izin per level
 * ============================================================================
 * SATU-SATUNYA tempat mengatur "siapa boleh memanggil apa".
 *
 * Aturan:
 *  - Kunci  = nama yang dipakai frontend:  appRun....saveTim_(form)
 *  - fn     = nama fungsi server (WAJIB berakhiran "_" agar privat)
 *  - roles  = level yang diizinkan: 'admin', 'user'
 *
 * Menambah fitur baru: buat fungsi privat (mis. saveHonor_) lalu daftarkan di sini.
 * Fungsi yang tidak terdaftar tidak bisa dipanggil dari browser.
 *
 * Kebijakan awal (menyesuaikan struktur menu):
 *  - Menu Admin (User, Tahun, Tim, Satuan): tulis & kelola = admin saja.
 *    Data Tahun/Tim/Satuan tetap boleh DIBACA semua level karena dipakai dropdown.
 *  - Menu Pegawai, Anggota Tim, Kegiatan: admin dan user.
 */
function getApiRegistry_() {
  var SEMUA = ['admin', 'user'];
  var ADMIN = ['admin'];

  return {
    // ---- Akun sendiri
    changePassword:        { fn: 'changePassword_',        roles: SEMUA },

    // ---- Master User (khusus admin)
    getUsers:              { fn: 'getUsers_',              roles: ADMIN },
    saveUser:              { fn: 'saveUser_',              roles: ADMIN },
    deleteUser:            { fn: 'deleteUser_',            roles: ADMIN },

    // ---- Master Tahun
    getTahunList:          { fn: 'getTahunList_',          roles: SEMUA },
    saveTahun:             { fn: 'saveTahun_',             roles: ADMIN },
    deleteTahun:           { fn: 'deleteTahun_',           roles: ADMIN },

    // ---- Master Tim
    getTimList:            { fn: 'getTimList_',            roles: SEMUA },
    getTimDetail:          { fn: 'getTimDetail_',          roles: SEMUA },
    saveTim:               { fn: 'saveTim_',               roles: ADMIN },
    deleteTim:             { fn: 'deleteTim_',             roles: ADMIN },

    // ---- Master Satuan
    getSatuanList:         { fn: 'getSatuanList_',         roles: SEMUA },
    saveSatuan:            { fn: 'saveSatuan_',            roles: ADMIN },
    deleteSatuan:          { fn: 'deleteSatuan_',          roles: ADMIN },

    // ---- Master Pegawai
    getPegawaiList:        { fn: 'getPegawaiList_',        roles: SEMUA },
    savePegawai:           { fn: 'savePegawai_',           roles: SEMUA },
    deletePegawai:         { fn: 'deletePegawai_',         roles: SEMUA },

    // ---- Anggota Tim
    getTimAnggotaList:     { fn: 'getTimAnggotaList_',     roles: SEMUA },
    getMasterReferences:   { fn: 'getMasterReferences_',   roles: SEMUA },
    saveTimAnggota:        { fn: 'saveTimAnggota_',        roles: SEMUA },
    deleteTimAnggota:      { fn: 'deleteTimAnggota_',      roles: SEMUA },
    batchDeleteTimAnggota: { fn: 'batchDeleteTimAnggota_', roles: SEMUA },

    // ---- Kegiatan
    getKegiatanList:       { fn: 'getKegiatanList_',       roles: SEMUA },
    saveKegiatan:          { fn: 'saveKegiatan_',          roles: SEMUA },
    deleteKegiatan:        { fn: 'deleteKegiatan_',        roles: SEMUA }
  };
}