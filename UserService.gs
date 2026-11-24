/**
 * ============================================================================
 * UserService.gs - Pengelolaan Data Master User di Sheet MASTER_USER
 * ============================================================================
 * Semua fungsi di sini PRIVAT dan hanya dapat dipanggil lewat apiCall (admin saja,
 * lihat ApiRegistry.gs). Password tidak pernah dikirim ke browser.
 */

var USER_STATUS_ = ['aktif', 'tidak_aktif'];

/**
 * Fungsi helper untuk mendapatkan objek Sheet 'MASTER_USER'.
 * Jika sheet belum ada, maka otomatis akan dibuatkan sheet baru beserta header kolomnya.
 */
function getUserSheet_() {
  return getOrCreateSheet_('MASTER_USER', ['ID_USER', 'NAMA', 'EMAIL', 'PASSWORD', 'LEVEL', 'STATUS', 'CREATED_AT']);
}

/**
 * 1. READ: Mengambil seluruh data user untuk ditampilkan ke frontend.
 * Kolom PASSWORD dibuang. Ditambahkan penanda IS_PROTECTED dan IS_SELF
 * agar frontend tahu akun mana yang tidak boleh diubah/dihapus.
 */
function getUsers_() {
  try {
    var me = CURRENT_USER_ ? String(CURRENT_USER_.ID_USER) : '';
    return readObjects_(getUserSheet_()).map(function (u) {
      delete u.PASSWORD;
      u.IS_PROTECTED = isProtectedEmail_(u.EMAIL);
      u.IS_SELF = me !== '' && String(u.ID_USER) === me;
      return u;
    });
  } catch (error) {
    throw new Error("Gagal mengambil data user: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan data baru atau memperbarui user.
 * - Password wajib untuk user baru; saat edit, kosong = password tidak diubah.
 * - Hanya kolom NAMA, EMAIL, PASSWORD, LEVEL, STATUS yang diterima dari klien.
 * - Akun terproteksi tidak dapat diubah; harus selalu ada minimal satu admin aktif.
 */
function saveUser_(formData) {
  try {
    formData = formData || {};
    var nama = String(formData.NAMA || '').trim();
    var email = String(formData.EMAIL || '').trim();
    var level = lower_(formData.LEVEL);
    var status = lower_(formData.STATUS);
    var password = (formData.PASSWORD === undefined || formData.PASSWORD === null) ? '' : String(formData.PASSWORD);

    // --- VALIDASI MASUKAN ---
    if (!nama) return { success: false, message: 'Gagal: Nama wajib diisi!' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, message: 'Gagal: Format email tidak valid!' };
    if (AUTH_LEVELS_.indexOf(level) === -1) return { success: false, message: 'Gagal: Level tidak valid!' };
    if (USER_STATUS_.indexOf(status) === -1) return { success: false, message: 'Gagal: Status tidak valid!' };
    if (password !== '' && password.length < AUTH_MIN_PASSWORD_LENGTH_) {
      return { success: false, message: 'Gagal: Password minimal ' + AUTH_MIN_PASSWORD_LENGTH_ + ' karakter!' };
    }
    if (password.length > AUTH_MAX_PASSWORD_LENGTH_) return { success: false, message: 'Gagal: Password terlalu panjang!' };

    return withLock_(function () {
      var sheet = getUserSheet_();
      var headers = getHeaders_(sheet);
      var users = readUsers_();

      var existing = null;
      if (formData.ID_USER) {
        for (var i = 0; i < users.length; i++) {
          if (String(users[i].ID_USER).trim() === String(formData.ID_USER).trim()) { existing = users[i]; break; }
        }
        if (!existing) return { success: false, message: 'User tidak ditemukan untuk diperbarui.' };
        if (isProtectedEmail_(existing.EMAIL)) {
          return { success: false, message: 'Gagal: Akun ini diproteksi dan tidak dapat diubah.' };
        }
      } else if (password === '') {
        return { success: false, message: 'Gagal: Password wajib diisi untuk user baru!' };
      }

      // --- VALIDASI EMAIL UNIK (tidak peka huruf besar/kecil) ---
      if (existsRow_(sheet, { EMAIL: email }, {
        caseInsensitive: true,
        excludeIdHeader: 'ID_USER',
        excludeId: formData.ID_USER
      })) {
        return { success: false, message: 'Gagal: Email "' + email + '" sudah terdaftar dalam sistem!' };
      }

      // --- JAGA MINIMAL SATU ADMIN AKTIF ---
      if (existing && isActiveAdmin_(existing) && !(level === 'admin' && status === 'aktif')) {
        var otherAdmins = users.filter(function (u) {
          return String(u.ID_USER) !== String(existing.ID_USER) && isActiveAdmin_(u);
        }).length;
        if (otherAdmins === 0) {
          return { success: false, message: 'Gagal: Minimal harus ada satu akun admin aktif.' };
        }
      }

      var data = { NAMA: nama, EMAIL: email, LEVEL: level, STATUS: status };
      if (password !== '') data.PASSWORD = makePasswordHash_(password);

      if (existing) {
        updateRow_(sheet, headers, existing.__row, data, ['ID_USER', 'CREATED_AT']);
        return { success: true, message: 'Data user berhasil diperbarui!' };
      }

      data.ID_USER = newId_('USR');
      data.CREATED_AT = nowString_();
      appendObject_(sheet, headers, data);
      return { success: true, message: 'User baru berhasil ditambahkan!' };
    });
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

/**
 * 3. DELETE: Menghapus user berdasarkan ID_USER.
 * Ditolak untuk akun terproteksi, akun yang sedang dipakai, dan admin aktif terakhir.
 */
function deleteUser_(idUser) {
  try {
    return withLock_(function () {
      var users = readUsers_();
      var target = null;
      for (var i = 0; i < users.length; i++) {
        if (String(users[i].ID_USER).trim() === String(idUser === undefined || idUser === null ? '' : idUser).trim()) {
          target = users[i];
          break;
        }
      }
      if (!target || String(idUser).trim() === '') return { success: false, message: 'Data user tidak ditemukan.' };

      if (isProtectedEmail_(target.EMAIL)) {
        return { success: false, message: 'Gagal: Akun ini diproteksi dan tidak dapat dihapus.' };
      }
      if (CURRENT_USER_ && String(CURRENT_USER_.ID_USER) === String(target.ID_USER)) {
        return { success: false, message: 'Gagal: Anda tidak dapat menghapus akun yang sedang Anda gunakan.' };
      }
      if (isActiveAdmin_(target)) {
        var otherAdmins = users.filter(function (u) {
          return String(u.ID_USER) !== String(target.ID_USER) && isActiveAdmin_(u);
        }).length;
        if (otherAdmins === 0) {
          return { success: false, message: 'Gagal: Minimal harus ada satu akun admin aktif.' };
        }
      }

      getUserSheet_().deleteRow(target.__row);
      return { success: true, message: 'User berhasil dihapus!' };
    });
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}