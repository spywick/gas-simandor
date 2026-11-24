/**
 * ============================================================================
 * AuthService.gs - Autentikasi (login, sesi, password) dan gerbang API
 * ============================================================================
 * Prinsip:
 *  1. Hanya fungsi berikut yang PUBLIK (bisa dipanggil dari browser):
 *       doGet, authLogin, authSession, authLogout, apiCall, setupAuth
 *     Semua fungsi lain berakhiran "_" sehingga PRIVAT: tidak dapat dipanggil
 *     dari browser lewat google.script.run.
 *  2. Semua akses data melewati apiCall(token, nama, args). Gerbang ini memeriksa
 *     sesi dan LEVEL user terhadap tabel izin di ApiRegistry.gs.
 *  3. Password disimpan sebagai hash bergaram + "pepper" rahasia (Script Properties),
 *     bukan teks biasa.
 *  4. Token sesi acak disimpan di CacheService (yang disimpan hanya hash token).
 *
 * Catatan batas: Apps Script tidak punya bcrypt/Argon2, jadi hash memakai
 * HMAC-SHA256 berulang. Pepper membuat hash di spreadsheet tidak bisa diserang
 * secara offline tanpa akses ke Script Properties.
 */

// ---------------------------- KONFIGURASI -----------------------------------
var AUTH_LEVELS_ = ['admin', 'user'];
var AUTH_HASH_PREFIX_ = 'h1';
var AUTH_HASH_ITERATIONS_ = 1000;        // Naikkan jika waktu hash (lihat setupAuth) masih kecil
var AUTH_MIN_PASSWORD_LENGTH_ = 8;
var AUTH_MAX_PASSWORD_LENGTH_ = 200;

var SESSION_IDLE_SEC_ = 2 * 60 * 60;     // Sesi berakhir jika tidak aktif 2 jam
var SESSION_ABSOLUTE_SEC_ = 12 * 60 * 60; // Batas mutlak 12 jam sejak login
var SESSION_REFRESH_AFTER_SEC_ = 5 * 60;  // Perpanjang masa aktif paling cepat tiap 5 menit

var LOGIN_MAX_FAIL_ = 5;                 // Gagal login berturut-turut sebelum dikunci
var LOGIN_LOCK_SEC_ = 15 * 60;           // Lama penguncian (detik)

// Akun yang tidak boleh diubah/dihapus lewat menu Manajemen User.
var PROTECTED_EMAILS_ = ['almunzir2@gmail.com'];

// Diisi apiCall() selama satu eksekusi (setiap eksekusi punya variabel global sendiri).
var CURRENT_USER_ = null;
var CURRENT_TOKEN_ = null;

// ----------------------------- UTILITAS -------------------------------------
function lower_(v) {
  return String(v === undefined || v === null ? '' : v).trim().toLowerCase();
}

function isActiveStatus_(status) {
  return lower_(status) === 'aktif';
}

function isProtectedEmail_(email) {
  var e = lower_(email);
  return PROTECTED_EMAILS_.some(function (p) { return lower_(p) === e; });
}

function isActiveAdmin_(user) {
  return lower_(user.LEVEL) === 'admin' && isActiveStatus_(user.STATUS);
}

function nowSec_() {
  return Math.floor(Date.now() / 1000);
}

function sha256Hex_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    var v = b < 0 ? b + 256 : b;
    return (v < 16 ? '0' : '') + v.toString(16);
  }).join('');
}

/** Perbandingan teks dengan waktu relatif konstan (mengurangi timing attack). */
function safeEqual_(a, b) {
  a = String(a);
  b = String(b);
  var diff = a.length ^ b.length;
  var len = Math.max(a.length, b.length);
  for (var i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Label user yang sedang beraksi, untuk kolom CREATED_BY / UPDATED_BY. */
function currentUserLabel_() {
  if (CURRENT_USER_ && CURRENT_USER_.EMAIL) return CURRENT_USER_.EMAIL;
  return Session.getActiveUser().getEmail() || 'Admin';
}

function publicUser_(user) {
  return {
    ID_USER: user.ID_USER,
    NAMA: user.NAMA,
    EMAIL: user.EMAIL,
    LEVEL: lower_(user.LEVEL)
  };
}

// ------------------------------ PASSWORD ------------------------------------
function getPepper_() {
  var pepper = PropertiesService.getScriptProperties().getProperty('AUTH_PEPPER');
  if (!pepper) {
    throw new Error('AUTH_NOT_READY: Autentikasi belum disiapkan. Jalankan setupAuth() sekali dari editor Apps Script.');
  }
  return pepper;
}

function hmacRounds_(password, salt, iterations) {
  var key = Utilities.base64Decode(getPepper_());
  var h = Utilities.newBlob(salt + ':' + password).getBytes();
  for (var i = 0; i < iterations; i++) {
    h = Utilities.computeHmacSha256Signature(h, key);
  }
  return Utilities.base64Encode(h);
}

function isHashed_(stored) {
  return String(stored === undefined || stored === null ? '' : stored).indexOf(AUTH_HASH_PREFIX_ + '$') === 0;
}

/** Format tersimpan: h1$<iterasi>$<salt>$<hash>. */
function makePasswordHash_(password) {
  var salt = Utilities.getUuid().replace(/-/g, '');
  return [AUTH_HASH_PREFIX_, AUTH_HASH_ITERATIONS_, salt, hmacRounds_(password, salt, AUTH_HASH_ITERATIONS_)].join('$');
}

/**
 * Memeriksa password terhadap nilai tersimpan.
 * needsRehash=true jika nilai tersimpan masih teks biasa (data lama) atau memakai
 * jumlah iterasi lebih rendah dari konfigurasi sekarang.
 */
function verifyPassword_(password, stored) {
  stored = String(stored === undefined || stored === null ? '' : stored);
  if (stored === '') return { ok: false, needsRehash: false };

  if (!isHashed_(stored)) {
    return { ok: safeEqual_(password, stored), needsRehash: true };
  }

  var parts = stored.split('$');
  var iterations = parseInt(parts[1], 10);
  if (parts.length !== 4 || !(iterations > 0) || iterations > 100000) {
    return { ok: false, needsRehash: false };
  }

  var ok = safeEqual_(hmacRounds_(password, parts[2], iterations), parts[3]);
  return { ok: ok, needsRehash: ok && iterations < AUTH_HASH_ITERATIONS_ };
}

/** Sidik jari singkat password tersimpan: berubah saat password diganti -> sesi lama gugur. */
function passwordStamp_(stored) {
  return sha256Hex_(String(stored === undefined || stored === null ? '' : stored)).substring(0, 16);
}

// -------------------------- DATA USER (INTERNAL) ----------------------------
function readUsers_() {
  var list = readObjects_(getUserSheet_());
  list.forEach(function (u, i) { u.__row = i + 2; });
  return list;
}

function findUserByEmail_(emailNorm) {
  var users = readUsers_();
  for (var i = 0; i < users.length; i++) {
    if (lower_(users[i].EMAIL) === emailNorm) return users[i];
  }
  return null;
}

function findUserById_(id) {
  var sheet = getUserSheet_();
  var row = findRowById_(sheet, 'ID_USER', id);
  if (!row) return null;
  var headers = getHeaders_(sheet);
  var values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  var user = {};
  headers.forEach(function (h, i) { user[h] = values[i]; });
  user.__row = row;
  return user;
}

// ------------------------- PEMBATASAN PERCOBAAN LOGIN -----------------------
function failKey_(emailNorm) {
  return 'lf:' + sha256Hex_(emailNorm);
}

function isLockedOut_(emailNorm) {
  return parseInt(CacheService.getScriptCache().get(failKey_(emailNorm)) || '0', 10) >= LOGIN_MAX_FAIL_;
}

function recordLoginFailure_(emailNorm) {
  var cache = CacheService.getScriptCache();
  var n = parseInt(cache.get(failKey_(emailNorm)) || '0', 10) + 1;
  cache.put(failKey_(emailNorm), String(n), LOGIN_LOCK_SEC_);
}

function clearLoginFailures_(emailNorm) {
  CacheService.getScriptCache().remove(failKey_(emailNorm));
}

// --------------------------------- SESI -------------------------------------
function sessionKey_(token) {
  return 'sess:' + sha256Hex_(token);
}

function createSession_(user) {
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var t = nowSec_();
  CacheService.getScriptCache().put(sessionKey_(token), JSON.stringify({
    uid: String(user.ID_USER),
    ph: passwordStamp_(user.PASSWORD),
    created: t,
    seen: t
  }), SESSION_IDLE_SEC_);
  return token;
}

function destroySession_(token) {
  if (typeof token === 'string' && token) {
    CacheService.getScriptCache().remove(sessionKey_(token));
  }
}

/**
 * Memuat sesi dari token. User dibaca ulang dari sheet pada setiap panggilan,
 * sehingga perubahan admin (nonaktifkan, ganti level, ganti password, hapus)
 * langsung berlaku. Mengembalikan { user } atau null.
 */
function loadSession_(token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 128) return null;

  var cache = CacheService.getScriptCache();
  var key = sessionKey_(token);
  var raw = cache.get(key);
  if (!raw) return null;

  var s;
  try { s = JSON.parse(raw); } catch (e) { cache.remove(key); return null; }

  var t = nowSec_();
  if (t - s.created > SESSION_ABSOLUTE_SEC_) { cache.remove(key); return null; }

  var user = findUserById_(s.uid);
  if (!user || !isActiveStatus_(user.STATUS) || AUTH_LEVELS_.indexOf(lower_(user.LEVEL)) === -1 ||
      s.ph !== passwordStamp_(user.PASSWORD)) {
    cache.remove(key);
    return null;
  }

  if (t - s.seen > SESSION_REFRESH_AFTER_SEC_) {
    s.seen = t;
    cache.put(key, JSON.stringify(s), SESSION_IDLE_SEC_);
  }
  return { user: user };
}

// ---------------------------- FUNGSI PUBLIK ---------------------------------
var MSG_LOGIN_FAILED_ = 'Email atau password salah, atau akun tidak aktif.';

/** Login. Mengembalikan { success, message, token, user }. */
function authLogin(email, password) {
  try {
    var emailNorm = lower_(email);
    var pwd = String(password === undefined || password === null ? '' : password);

    if (!emailNorm || !pwd) {
      return { success: false, message: 'Email dan password wajib diisi.' };
    }
    if (emailNorm.length > 254 || pwd.length > AUTH_MAX_PASSWORD_LENGTH_) {
      return { success: false, message: MSG_LOGIN_FAILED_ };
    }
    if (isLockedOut_(emailNorm)) {
      return { success: false, locked: true,
               message: 'Terlalu banyak percobaan gagal. Coba lagi dalam ' + Math.ceil(LOGIN_LOCK_SEC_ / 60) + ' menit.' };
    }

    var user = findUserByEmail_(emailNorm);
    var verified = { ok: false, needsRehash: false };

    if (user) {
      verified = verifyPassword_(pwd, user.PASSWORD);
    } else {
      // Email tidak ada: tetap hitung hash agar waktu respons tidak membocorkan keberadaan akun
      hmacRounds_(pwd, 'tidak-ada-akun', AUTH_HASH_ITERATIONS_);
    }

    if (!user || !verified.ok || !isActiveStatus_(user.STATUS)) {
      recordLoginFailure_(emailNorm);
      return { success: false, message: MSG_LOGIN_FAILED_ };
    }

    if (AUTH_LEVELS_.indexOf(lower_(user.LEVEL)) === -1) {
      return { success: false, message: 'Level akun tidak valid. Hubungi administrator.' };
    }

    clearLoginFailures_(emailNorm);

    if (verified.needsRehash) {
      var newHash = upgradePasswordHash_(user, pwd);
      if (newHash) user.PASSWORD = newHash;
    }

    return { success: true, message: 'Login berhasil.', token: createSession_(user), user: publicUser_(user) };
  } catch (error) {
    if (String(error.message).indexOf('AUTH_NOT_READY') !== -1) {
      return { success: false, message: 'Sistem autentikasi belum disiapkan. Hubungi administrator.' };
    }
    Logger.log('authLogin error: ' + error.message);
    return { success: false, message: 'Terjadi kesalahan pada server. Silakan coba lagi.' };
  }
}

/** Mengganti password teks biasa (data lama) / iterasi rendah dengan hash terbaru. */
function upgradePasswordHash_(user, plainPassword) {
  var result = withLock_(function () {
    var fresh = findUserById_(user.ID_USER);
    if (!fresh || String(fresh.PASSWORD) !== String(user.PASSWORD)) return null; // berubah di tengah jalan
    var newHash = makePasswordHash_(plainPassword);
    var sheet = getUserSheet_();
    updateRow_(sheet, getHeaders_(sheet), fresh.__row, { PASSWORD: newHash }, ['ID_USER', 'CREATED_AT']);
    return newHash;
  });
  return (typeof result === 'string') ? result : null;
}

/** Memulihkan sesi saat halaman dimuat ulang. */
function authSession(token) {
  try {
    var s = loadSession_(token);
    if (!s) return { success: false };
    return { success: true, user: publicUser_(s.user) };
  } catch (error) {
    return { success: false };
  }
}

function authLogout(token) {
  try { destroySession_(token); } catch (e) { /* abaikan */ }
  return { success: true };
}

/**
 * GERBANG API: satu-satunya jalan frontend ke fungsi data.
 * token : token sesi dari authLogin
 * name  : nama fungsi (kunci di getApiRegistry_)
 * args  : array argumen
 */
function apiCall(token, name, args) {
  var session = loadSession_(token);
  if (!session) {
    throw new Error('AUTH_REQUIRED: Sesi berakhir. Silakan login kembali.');
  }

  var registry = getApiRegistry_();
  if (typeof name !== 'string' || !Object.prototype.hasOwnProperty.call(registry, name)) {
    throw new Error('API_NOT_FOUND: Fungsi tidak dikenal.');
  }

  var entry = registry[name];
  if (entry.roles.indexOf(lower_(session.user.LEVEL)) === -1) {
    throw new Error('AUTH_FORBIDDEN: Anda tidak memiliki akses untuk tindakan ini.');
  }

  var fn = globalThis[entry.fn];
  if (typeof fn !== 'function') {
    throw new Error('API_NOT_FOUND: Fungsi tidak tersedia.');
  }

  CURRENT_USER_ = publicUser_(session.user);
  CURRENT_TOKEN_ = token;
  try {
    return fn.apply(null, Array.isArray(args) ? args : []);
  } finally {
    CURRENT_USER_ = null;
    CURRENT_TOKEN_ = null;
  }
}

/** Ganti password sendiri (dipanggil lewat apiCall). Mengembalikan token baru. */
function changePassword_(oldPassword, newPassword) {
  try {
    oldPassword = String(oldPassword === undefined || oldPassword === null ? '' : oldPassword);
    newPassword = String(newPassword === undefined || newPassword === null ? '' : newPassword);

    if (newPassword.length < AUTH_MIN_PASSWORD_LENGTH_) {
      return { success: false, message: 'Password baru minimal ' + AUTH_MIN_PASSWORD_LENGTH_ + ' karakter.' };
    }
    if (newPassword.length > AUTH_MAX_PASSWORD_LENGTH_) {
      return { success: false, message: 'Password terlalu panjang.' };
    }
    if (newPassword === oldPassword) {
      return { success: false, message: 'Password baru harus berbeda dari password lama.' };
    }

    var emailNorm = lower_(CURRENT_USER_.EMAIL);
    if (isLockedOut_(emailNorm)) {
      return { success: false, message: 'Terlalu banyak percobaan gagal. Coba lagi beberapa saat.' };
    }

    return withLock_(function () {
      var user = findUserById_(CURRENT_USER_.ID_USER);
      if (!user) return { success: false, message: 'Akun tidak ditemukan.' };

      if (!verifyPassword_(oldPassword, user.PASSWORD).ok) {
        recordLoginFailure_(emailNorm);
        return { success: false, message: 'Password lama salah.' };
      }

      var newHash = makePasswordHash_(newPassword);
      var sheet = getUserSheet_();
      updateRow_(sheet, getHeaders_(sheet), user.__row, { PASSWORD: newHash }, ['ID_USER', 'CREATED_AT']);
      clearLoginFailures_(emailNorm);

      // Sesi lain milik user ini gugur otomatis (sidik jari password berubah); sesi ini diganti baru.
      destroySession_(CURRENT_TOKEN_);
      user.PASSWORD = newHash;
      return { success: true, message: 'Password berhasil diubah.', token: createSession_(user) };
    });
  } catch (error) {
    return { success: false, message: 'Gagal mengubah password: ' + error.message };
  }
}

/**
 * SETUP SEKALI JALAN - jalankan dari editor Apps Script (pilih setupAuth -> Run).
 * Aman dijalankan berulang. Langkah:
 *  1. Membuat "pepper" rahasia di Script Properties (jika belum ada).
 *  2. Mengubah semua password teks biasa di MASTER_USER menjadi hash.
 *  3. Menampilkan waktu hash dan peringatan di Execution log.
 * Hanya pemilik script yang dapat menjalankannya.
 */
function setupAuth() {
  var active = Session.getActiveUser().getEmail();
  var owner = Session.getEffectiveUser().getEmail();
  if (!active || !owner || active !== owner) {
    throw new Error('setupAuth hanya dapat dijalankan oleh pemilik script dari editor Apps Script.');
  }

  var report = [];
  var props = PropertiesService.getScriptProperties();

  if (!props.getProperty('AUTH_PEPPER')) {
    var seed = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid() + Date.now();
    var pepper = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, seed, Utilities.Charset.UTF_8);
    props.setProperty('AUTH_PEPPER', Utilities.base64Encode(pepper));
    report.push('Pepper rahasia dibuat.');
  } else {
    report.push('Pepper sudah ada (tidak diubah).');
  }

  var migrated = 0;
  var empty = 0;
  withLock_(function () {
    var sheet = getUserSheet_();
    var col = getHeaders_(sheet).indexOf('PASSWORD');
    var lastRow = sheet.getLastRow();
    if (col === -1 || lastRow < 2) return;

    var range = sheet.getRange(2, col + 1, lastRow - 1, 1);
    var values = range.getValues().map(function (r) {
      var v = r[0];
      if (v === '' || v === null || v === undefined) { empty++; return [v]; }
      if (isHashed_(v)) return [v];
      migrated++;
      return [makePasswordHash_(String(v))];
    });
    range.setValues(values);
  });
  report.push(migrated + ' password teks biasa diubah menjadi hash.');
  if (empty > 0) report.push('PERINGATAN: ' + empty + ' user belum punya password (tidak bisa login sampai admin mengisinya).');

  var t0 = Date.now();
  makePasswordHash_('uji-kecepatan');
  report.push('Waktu satu proses hash: ' + (Date.now() - t0) + ' ms (iterasi ' + AUTH_HASH_ITERATIONS_ + ').');

  var admins = readUsers_().filter(isActiveAdmin_).length;
  report.push(admins > 0 ? admins + ' admin aktif ditemukan.'
                         : 'PERINGATAN: tidak ada admin aktif. Set LEVEL=admin dan STATUS=aktif pada satu user di sheet MASTER_USER.');

  report.forEach(function (line) { Logger.log(line); });
  return report.join('\n');
}