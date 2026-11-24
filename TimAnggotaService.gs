/**
 * ============================================================================
 * TimAnggotaService.gs - Pengelolaan Data Master Tim Anggota di Sheet MASTER_TIM_ANGGOTA
 * ============================================================================
 * Helper bersama (lock, pencarian baris, cek duplikat) ada di SheetRepo.gs.
 */

function getTimAnggotaSheet_() {
  return getOrCreateSheet_('MASTER_TIM_ANGGOTA', [
    'ID_DETAIL_TIM', 'TAHUN_ID', 'TIM_ID', 'PEGAWAI_ID',
    'PERAN', 'KETERANGAN', 'CREATED_AT'
  ]);
}

/**
 * Mengambil seluruh data anggota tim (beserta mapping label teks tahun, tim, dan pegawai).
 */
function getTimAnggotaList_() {
  try {
    var list = readObjects_(getTimAnggotaSheet_());
    if (!list.length) return [];

    var tahunMap = lookupMap_('MASTER_TAHUN', 'ID_TAHUN', 'TAHUN');             // ID_TAHUN -> TAHUN
    var timMap = lookupMap_('MASTER_TIM', 'ID_TIM', 'NAMA_TIM');                // ID_TIM -> NAMA_TIM
    var pegawaiMap = lookupMap_('MASTER_PEGAWAI', 'ID_PEGAWAI', 'NAMA_PEGAWAI'); // ID_PEGAWAI -> NAMA_PEGAWAI

    list.forEach(function (obj) {
      // Tambahkan label teks untuk ditampilkan di tabel
      obj['TAHUN_LABEL'] = tahunMap[obj['TAHUN_ID']] || obj['TAHUN_ID'];
      obj['TIM_LABEL'] = timMap[obj['TIM_ID']] || obj['TIM_ID'];
      obj['PEGAWAI_LABEL'] = pegawaiMap[obj['PEGAWAI_ID']] || obj['PEGAWAI_ID'];
    });
    return list;
  } catch (error) {
    throw new Error("Gagal mengambil data anggota tim: " + error.message);
  }
}

/**
 * Mengambil referensi data Master (Tahun, Tim, dan Pegawai Aktif) untuk dropdown form.
 */
function getMasterReferences_() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Data Tahun
    var tahunList = [];
    var thnSheet = ss.getSheetByName('MASTER_TAHUN');
    if (thnSheet && thnSheet.getLastRow() > 1) {
      var thnData = thnSheet.getDataRange().getValues();
      var tHead = thnData[0];
      var idThn = tHead.indexOf('ID_TAHUN');
      var valThn = tHead.indexOf('TAHUN');
      for (var t = 1; t < thnData.length; t++) {
        tahunList.push({ ID_TAHUN: thnData[t][idThn], TAHUN: thnData[t][valThn] });
      }
    }

    // 2. Data Tim
    var timList = [];
    var timSheet = ss.getSheetByName('MASTER_TIM');
    if (timSheet && timSheet.getLastRow() > 1) {
      var timData = timSheet.getDataRange().getValues();
      var tmHead = timData[0];
      var idTim = tmHead.indexOf('ID_TIM');
      var thnIdTim = tmHead.indexOf('TAHUN_ID');
      var valTim = tmHead.indexOf('NAMA_TIM');
      for (var m = 1; m < timData.length; m++) {
        timList.push({
          ID_TIM: timData[m][idTim],
          TAHUN_ID: timData[m][thnIdTim],
          NAMA_TIM: timData[m][valTim]
        });
      }
    }

    // 3. Data Pegawai (Hanya yang statusnya 'Aktif')
    var pegawaiList = [];
    var pgwSheet = ss.getSheetByName('MASTER_PEGAWAI');
    if (pgwSheet && pgwSheet.getLastRow() > 1) {
      var pgwData = pgwSheet.getDataRange().getValues();
      var pHead = pgwData[0];
      var idPgw = pHead.indexOf('ID_PEGAWAI');
      var valPgw = pHead.indexOf('NAMA_PEGAWAI');
      var nipBaruIdx = pHead.indexOf('NIP_BARU');
      var nipLamaIdx = pHead.indexOf('NIP_LAMA');
      var statusIdx = pHead.indexOf('STATUS');

      for (var p = 1; p < pgwData.length; p++) {
        var status = pgwData[p][statusIdx];
        if (!status || status === 'Aktif') { // Sesuai permintaan: ambil yang aktif
          pegawaiList.push({
            ID_PEGAWAI: pgwData[p][idPgw],
            NAMA_PEGAWAI: pgwData[p][valPgw],
            NIP: pgwData[p][nipBaruIdx] || pgwData[p][nipLamaIdx] || '-'
          });
        }
      }
    }

    return {
      tahunList: tahunList,
      timList: timList,
      pegawaiList: pegawaiList
    };
  } catch (error) {
    throw new Error("Gagal memuat referensi master: " + error.message);
  }
}

/**
 * 2. CREATE / UPDATE: Menyimpan atau memperbarui data anggota tim (Mendukung Batch Multiple Pegawai).
 * Pegawai yang sama tidak boleh terdaftar dua kali pada kombinasi Tahun + Tim yang sama.
 */
function saveTimAnggota_(formData) {
  try {
    return withLock_(function () {
      var sheet = getTimAnggotaSheet_();
      var headers = getHeaders_(sheet);

      // Jika mode UPDATE (berdasarkan ID_DETAIL_TIM yang ada)
      if (formData.ID_DETAIL_TIM) {
        var rowIndex = findRowById_(sheet, 'ID_DETAIL_TIM', formData.ID_DETAIL_TIM);
        if (!rowIndex) {
          return { success: false, message: 'Data anggota tim tidak ditemukan.' };
        }

        if (existsRow_(sheet,
          { TAHUN_ID: formData.TAHUN_ID, TIM_ID: formData.TIM_ID, PEGAWAI_ID: formData.PEGAWAI_ID },
          { excludeIdHeader: 'ID_DETAIL_TIM', excludeId: formData.ID_DETAIL_TIM })) {
          return { success: false, message: 'Gagal: Pegawai tersebut sudah terdaftar pada tim dan tahun yang sama!' };
        }

        updateRow_(sheet, headers, rowIndex, formData, ['ID_DETAIL_TIM', 'CREATED_AT']);
        return { success: true, message: 'Data anggota tim berhasil diperbarui!' };
      }

      // Jika mode CREATE (Tambah Baru - Mendukung Multiple Pegawai)
      var pegawaiIds = formData.PEGAWAI_ID;

      // Pastikan pegawaiIds berupa array, jika string tunggal ubah jadi array
      if (!Array.isArray(pegawaiIds)) {
        pegawaiIds = [pegawaiIds];
      }

      if (pegawaiIds.length === 0 || !pegawaiIds[0]) {
        return { success: false, message: 'Pilih minimal satu pegawai!' };
      }

      var now = nowString_();
      var rowsToAdd = [];
      var skipped = 0;
      var seen = {};

      for (var i = 0; i < pegawaiIds.length; i++) {
        var pid = pegawaiIds[i];
        var alreadyInSheet = existsRow_(sheet, { TAHUN_ID: formData.TAHUN_ID, TIM_ID: formData.TIM_ID, PEGAWAI_ID: pid });

        if (alreadyInSheet || seen[pid]) {
          skipped++;
          continue;
        }
        seen[pid] = true;

        rowsToAdd.push({
          ID_DETAIL_TIM: newId_('TIMANGGOTA'),
          TAHUN_ID: formData.TAHUN_ID,
          TIM_ID: formData.TIM_ID,
          PEGAWAI_ID: pid,
          PERAN: formData.PERAN,
          KETERANGAN: formData.KETERANGAN || '',
          CREATED_AT: now
        });
      }

      if (rowsToAdd.length === 0) {
        return { success: false, message: 'Gagal: seluruh pegawai yang dipilih sudah terdaftar pada tim dan tahun yang sama.' };
      }

      // Satu kali tulis untuk seluruh baris baru
      appendObjects_(sheet, headers, rowsToAdd);

      var msg = rowsToAdd.length + ' anggota tim berhasil ditambahkan secara batch!';
      if (skipped > 0) {
        msg += ' ' + skipped + ' pegawai dilewati karena sudah terdaftar pada tim dan tahun yang sama.';
      }
      return { success: true, message: msg };
    });
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

function deleteTimAnggota_(idDetailTim) {
  try {
    return withLock_(function () {
      var sheet = getTimAnggotaSheet_();
      var rowIndex = findRowById_(sheet, 'ID_DETAIL_TIM', idDetailTim);

      if (rowIndex) {
        sheet.deleteRow(rowIndex);
        return { success: true, message: 'Data anggota tim berhasil dihapus!' };
      }
      return { success: false, message: 'Data anggota tim tidak ditemukan.' };
    });
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}

/**
 * 4. BATCH DELETE: Menghapus beberapa data anggota tim sekaligus berdasarkan array ID_DETAIL_TIM.
 */
function batchDeleteTimAnggota_(idDetailTimArray) {
  try {
    if (!Array.isArray(idDetailTimArray) || idDetailTimArray.length === 0) {
      return { success: false, message: 'Tidak ada data yang dipilih untuk dihapus.' };
    }

    return withLock_(function () {
      var sheet = getTimAnggotaSheet_();
      var lastRow = sheet.getLastRow();
      var idCol = getHeaders_(sheet).indexOf('ID_DETAIL_TIM') + 1;

      if (idCol < 1 || lastRow < 2) {
        return { success: true, message: '0 data anggota tim berhasil dihapus secara massal!' };
      }

      var ids = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
      var wanted = {};
      idDetailTimArray.forEach(function (id) { wanted[String(id).trim()] = true; });

      // Kumpulkan baris yang akan dihapus
      var rowsToDelete = [];
      for (var i = 0; i < ids.length; i++) {
        if (wanted[String(ids[i][0]).trim()]) rowsToDelete.push(i + 2);
      }

      // Hapus dari bawah ke atas agar indeks baris tidak bergeser
      rowsToDelete.sort(function (a, b) { return b - a; });
      for (var j = 0; j < rowsToDelete.length; j++) {
        sheet.deleteRow(rowsToDelete[j]);
      }

      return { success: true, message: rowsToDelete.length + ' data anggota tim berhasil dihapus secara massal!' };
    });
  } catch (error) {
    return { success: false, message: "Gagal menghapus massal: " + error.message };
  }
}
