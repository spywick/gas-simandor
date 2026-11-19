/**
 * ============================================================================
 * TimAnggotaService.gs - Pengelolaan Data Master Tim Anggota di Sheet MASTER_TIM_ANGGOTA
 * ============================================================================
 */

function getTimAnggotaSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('MASTER_TIM_ANGGOTA');
  
  if (!sheet) {
    sheet = ss.insertSheet('MASTER_TIM_ANGGOTA');
    sheet.appendRow([
      'ID_DETAIL_TIM', 'TAHUN_ID', 'TIM_ID', 'PEGAWAI_ID', 
      'PERAN', 'KETERANGAN', 'CREATED_AT'
    ]);
  }
  return sheet;
}

/**
 * Mengambil seluruh data anggota tim (beserta mapping label teks tahun, tim, dan pegawai).
 */
function getTimAnggotaList() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = getTimAnggotaSheet();
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return [];

    var headers = data[0];

    // Mapping Tahun (ID_TAHUN -> TAHUN)
    var tahunMap = {};
    var thnSheet = ss.getSheetByName('MASTER_TAHUN');
    if (thnSheet && thnSheet.getLastRow() > 1) {
      var thnData = thnSheet.getDataRange().getValues();
      var tHead = thnData[0];
      var idThn = tHead.indexOf('ID_TAHUN');
      var valThn = tHead.indexOf('TAHUN');
      for (var t = 1; t < thnData.length; t++) {
        tahunMap[thnData[t][idThn]] = thnData[t][valThn];
      }
    }

    // Mapping Tim (ID_TIM -> NAMA_TIM)
    var timMap = {};
    var timSheet = ss.getSheetByName('MASTER_TIM');
    if (timSheet && timSheet.getLastRow() > 1) {
      var timData = timSheet.getDataRange().getValues();
      var tmHead = timData[0];
      var idTim = tmHead.indexOf('ID_TIM');
      var valTim = tmHead.indexOf('NAMA_TIM');
      for (var m = 1; m < timData.length; m++) {
        timMap[timData[m][idTim]] = timData[m][valTim];
      }
    }

    // Mapping Pegawai (ID_PEGAWAI -> NAMA_PEGAWAI)
    var pegawaiMap = {};
    var pgwSheet = ss.getSheetByName('MASTER_PEGAWAI');
    if (pgwSheet && pgwSheet.getLastRow() > 1) {
      var pgwData = pgwSheet.getDataRange().getValues();
      var pHead = pgwData[0];
      var idPgw = pHead.indexOf('ID_PEGAWAI');
      var valPgw = pHead.indexOf('NAMA_PEGAWAI');
      for (var p = 1; p < pgwData.length; p++) {
        pegawaiMap[pgwData[p][idPgw]] = pgwData[p][valPgw];
      }
    }

    var result = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var obj = {};
      
      headers.forEach(function(header, index) {
        if (header === 'CREATED_AT' && row[index] instanceof Date) {
          obj[header] = Utilities.formatDate(row[index], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        } else {
          obj[header] = row[index];
        }
      });

      // Tambahkan label teks untuk ditampilkan di tabel
      obj['TAHUN_LABEL'] = tahunMap[obj['TAHUN_ID']] || obj['TAHUN_ID'];
      obj['TIM_LABEL'] = timMap[obj['TIM_ID']] || obj['TIM_ID'];
      obj['PEGAWAI_LABEL'] = pegawaiMap[obj['PEGAWAI_ID']] || obj['PEGAWAI_ID'];

      result.push(obj);
    }
    return result;
  } catch (error) {
    throw new Error("Gagal mengambil data anggota tim: " + error.message);
  }
}

/**
 * Mengambil referensi data Master (Tahun, Tim, dan Pegawai Aktif) untuk dropdown form.
 */
function getMasterReferences() {
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
 */
function saveTimAnggota(formData) {
  try {
    var sheet = getTimAnggotaSheet();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    // Jika mode UPDATE (berdasarkan ID_DETAIL_TIM yang ada)
    if (formData.ID_DETAIL_TIM) {
      var idFinder = sheet.createTextFinder(formData.ID_DETAIL_TIM);
      var idMatch = idFinder.findNext();
      
      if (idMatch) {
        var rowIndex = idMatch.getRow();
        headers.forEach(function(header, colIdx) {
          if (header !== 'ID_DETAIL_TIM' && header !== 'CREATED_AT') {
            sheet.getRange(rowIndex, colIdx + 1).setValue(formData[header] !== undefined ? formData[header] : '');
          }
        });
        return { success: true, message: 'Data anggota tim berhasil diperbarui!' };
      } else {
        return { success: false, message: 'Data anggota tim tidak ditemukan.' };
      }
    } 
    
    // Jika mode CREATE (Tambah Baru - Mendukung Multiple Pegawai)
    else {
      var pegawaiIds = formData.PEGAWAI_ID;
      
      // Pastikan pegawaiIds berupa array, jika string tunggal ubah jadi array
      if (!Array.isArray(pegawaiIds)) {
        pegawaiIds = [pegawaiIds];
      }

      if (pegawaiIds.length === 0 || !pegawaiIds[0]) {
        return { success: false, message: 'Pilih minimal satu pegawai!' };
      }

      // Loop untuk menyimpan setiap pegawai yang dipilih sekaligus
      for (var i = 0; i < pegawaiIds.length; i++) {
        var newId = 'TIMANGGOTA-' + Utilities.getUuid().substring(0, 8).toUpperCase();
        
        var rowData = {
          ID_DETAIL_TIM: newId,
          TAHUN_ID: formData.TAHUN_ID,
          TIM_ID: formData.TIM_ID,
          PEGAWAI_ID: pegawaiIds[i],
          PERAN: formData.PERAN,
          KETERANGAN: formData.KETERANGAN || '',
          CREATED_AT: now
        };

        var newRow = headers.map(function(header) {
          return rowData[header] !== undefined ? rowData[header] : '';
        });

        sheet.appendRow(newRow);
      }

      return { success: true, message: pegawaiIds.length + ' anggota tim berhasil ditambahkan secara batch!' };
    }
  } catch (error) {
    return { success: false, message: "Terjadi kesalahan: " + error.message };
  }
}

function deleteTimAnggota(idDetailTim) {
  try {
    var sheet = getTimAnggotaSheet();
    var finder = sheet.createTextFinder(idDetailTim);
    var match = finder.findNext();

    if (match) {
      sheet.deleteRow(match.getRow());
      return { success: true, message: 'Data anggota tim berhasil dihapus!' };
    }
    return { success: false, message: 'Data anggota tim tidak ditemukan.' };
  } catch (error) {
    return { success: false, message: "Gagal menghapus: " + error.message };
  }
}

/**
 * 4. BATCH DELETE: Menghapus beberapa data anggota tim sekaligus berdasarkan array ID_DETAIL_TIM.
 */
function batchDeleteTimAnggota(idDetailTimArray) {
  try {
    var sheet = getTimAnggotaSheet();
    var data = sheet.getDataRange().getValues();
    var idColIdx = 0; // Kolom pertama (ID_DETAIL_TIM)

    if (!Array.isArray(idDetailTimArray) || idDetailTimArray.length === 0) {
      return { success: false, message: 'Tidak ada data yang dipilih untuk dihapus.' };
    }

    // Kumpulkan baris yang akan dihapus (dari bawah ke atas agar indeks baris tidak bergeser saat dihapus)
    var rowsToDelete = [];
    for (var i = 1; i < data.length; i++) {
      var currentId = data[i][idColIdx];
      if (idDetailTimArray.indexOf(currentId) !== -1) {
        rowsToDelete.push(i + 1); // Indeks baris di sheet (1-based)
      }
    }

    // Urutkan baris secara descending (dari bawah ke atas)
    rowsToDelete.sort(function(a, b) { return b - a; });

    for (var j = 0; j < rowsToDelete.length; j++) {
      sheet.deleteRow(rowsToDelete[j]);
    }

    return { success: true, message: rowsToDelete.length + ' data anggota tim berhasil dihapus secara massal!' };
  } catch (error) {
    return { success: false, message: "Gagal menghapus massal: " + error.message };
  }
}