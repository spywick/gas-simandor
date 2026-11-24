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
function getTimSheet_() {
  return getOrCreateSheet_('MASTER_TIM', ['ID_TIM', 'TAHUN_ID', 'NAMA_TIM', 'KETERANGAN', 'CREATED_AT']);
}

/**
 * 1. READ: Mengambil seluruh data tim (beserta relasi teks tahun jika diperlukan).
 */
function getTimList_() {
  try {
    var list = readObjects_(getTimSheet_());
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
 * 4. DETAIL: Mengambil informasi satu tim beserta daftar anggotanya
 * (join ke MASTER_TIM_ANGGOTA dan MASTER_PEGAWAI). Ketua diurutkan paling atas,
 * lalu anggota lain berurutan abjad.
 * Mengembalikan { tim: {...}, anggota: [...] }.
 */
function getTimDetail_(idTim) {
  try {
    var target = String(idTim === undefined || idTim === null ? '' : idTim).trim();

    var tim = readObjects_(getTimSheet_()).filter(function (t) {
      return String(t.ID_TIM).trim() === target;
    })[0];
    if (!tim) throw new Error('Data tim tidak ditemukan.');

    var tahunMap = lookupMap_('MASTER_TAHUN', 'ID_TAHUN', 'TAHUN');
    tim.TAHUN_LABEL = tahunMap[tim.TAHUN_ID] || tim.TAHUN_ID;

    // Peta ID_PEGAWAI -> data pegawai
    var pegawaiById = {};
    readObjects_(getPegawaiSheet_(), ['TANGGAL_LAHIR']).forEach(function (p) {
      pegawaiById[p.ID_PEGAWAI] = p;
    });

    var anggota = readObjects_(getTimAnggotaSheet_())
      .filter(function (a) { return String(a.TIM_ID).trim() === target; })
      .map(function (a) {
        var p = pegawaiById[a.PEGAWAI_ID] || {};
        return {
          ID_DETAIL_TIM: a.ID_DETAIL_TIM,
          PEGAWAI_ID: a.PEGAWAI_ID,
          PEGAWAI_LABEL: p.NAMA_PEGAWAI || a.PEGAWAI_ID,
          NIP: String(p.NIP_BARU || p.NIP_LAMA || ''),
          JABATAN: p.JABATAN || '',
          GOL_RUANG: p.GOL_RUANG || '',
          NO_HP: String(p.NO_HP || ''),
          EMAIL_SATKER: p.EMAIL_SATKER || '',
          STATUS: p.STATUS || '',
          PERAN: a.PERAN || 'Anggota',
          KETERANGAN: a.KETERANGAN || ''
        };
      });

    anggota.sort(function (a, b) {
      var ra = String(a.PERAN).trim().toLowerCase() === 'ketua' ? 0 : 1;
      var rb = String(b.PERAN).trim().toLowerCase() === 'ketua' ? 0 : 1;
      if (ra !== rb) return ra - rb;
      return String(a.PEGAWAI_LABEL).localeCompare(String(b.PEGAWAI_LABEL));
    });

    return { tim: tim, anggota: anggota };
  } catch (error) {
    throw new Error("Gagal mengambil detail tim: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan atau memperbarui data tim.
 */
function saveTim_(formData) {
  try {
    return withLock_(function () {
      var sheet = getTimSheet_();
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
function deleteTim_(idTim) {
  try {
    return withLock_(function () {
      var sheet = getTimSheet_();
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