# 📊 SIMANDOR - Sistem Informasi Monitoring Kinerja dan Honor

**SIMANDOR** adalah aplikasi web modular berbasis **Google Apps Script (GAS)**, **Vue.js 3**, dan **Tailwind CSS** yang dirancang untuk memantau kinerja pegawai serta pengelolaan dan pembayaran honorarium mitra secara terstruktur, akurat, dan berbasis acuan tahunan.

Aplikasi ini menggunakan **Google Sheets** sebagai basis data relasional (*Virtual JOIN*) dengan antarmuka pengguna modern yang responsif dan berkinerja tinggi.

## 🚀 Fitur Utama

* **Authentication & User Management (Master User)**:
  * Manajemen akses berbasis level (`admin` & `user`).
  * Validasi format email & proteksi akun Super Admin.
  * Pencarian (*live search*), filter status, dan *pagination* data dinamis.

* **Arsitektur Modular Vue 3 Component**:
  * Tampilan *Single Page Application* (SPA) dengan navigasi *Sidebar* responsif ala Dashboard SIPALA.
  * Form dialog berbentuk *Modal* untuk operasi CRUD (Create, Read, Update, Delete).

* **Multi-Tahun & Multi-Tim (Relasional)**:
  * Pengelompokan data kinerja dan honor berdasarkan acuan `MASTER_TAHUN` & `MASTER_TIM`.
  * Struktur *foreign key* yang konsisten (`tahun_id`, `tim_id`) untuk menjaga integritas data lintas tahun.

* **Header & Widget Real-time**:
  * Jam digital real-time dan penanda tanggal Indonesia.
  * Menu responsif untuk tampilan layar komputer maupun perangkat seluler (*mobile*).

## 🛠️ Teknologi yang Digunakan

* **Backend / Service Layer**: [Google Apps Script (GAS)](https://developers.google.com/apps-script)
* **Database**: [Google Sheets](https://www.google.com/sheets/about/)
* **Frontend Framework**: [Vue.js 3](https://vuejs.org/) (via CDN)
* **CSS Framework**: [Tailwind CSS](https://tailwindcss.com/) (via CDN)

## 📁 Struktur File & Projek

Aplikasi ini menggunakan pola struktur modular di Google Apps Script editor:

```
SIMANDOR/
├── Code.gs                   # Router utama Web App (doGet) & helper include template
├── UserService.gs            # Logic backend & database CRUD (Sheet: MASTER_USER)
├── TahunService.gs           # Logic backend (Sheet: MASTER_TAHUN) - Upcoming
├── TimService.gs             # Logic backend (Sheet: MASTER_TIM) - Upcoming
├── KegiatanService.gs        # Logic backend (Sheet: MASTER_KEGIATAN) - Upcoming
├── Index.html                # Kerangka layout utama, CDN loader, header, footer & Vue mounting
├── Sidebar.html              # Komponen menu navigasi samping responsif
├── Page_Beranda.html         # Komponen halaman Beranda / Welcome Screen
├── Page_User.html            # Komponen halaman Master User (Tabel, Modal, Pagination)
├── Page_Tahun.html           # Komponen halaman Master Tahun
├── Page_Tim.html             # Komponen halaman Master Tim
└── Page_Kegiatan.html        # Komponen halaman Master Kegiatan
```

## 🗄️ Skema Database (Google Sheets)

Aplikasi ini memanfaatkan sheet dalam satu spreadsheet Google Sheets sebagai tabel relasional:

### 1. `MASTER_USER`

| Kolom | Tipe Data | Keterangan | 
| ----- | ----- | ----- | 
| `ID_USER` | String (UUID) | Primary Key unik | 
| `NAMA` | String | Nama lengkap pengguna | 
| `EMAIL` | String | Email terdaftar (Format validasi) | 
| `PASSWORD` | String | Kata sandi akses | 
| `LEVEL` | Enum (`admin`, `user`) | Hak akses pengguna | 
| `STATUS` | Enum (`aktif`, `tidak_aktif`) | Status keaktifan akun | 
| `CREATED_AT` | Timestamp | Waktu pembuatan | 

### 2. `MASTER_TAHUN`

| Kolom | Tipe Data | Keterangan | 
| ----- | ----- | ----- | 
| `ID_TAHUN` | String (UUID) | Primary Key | 
| `TAHUN` | Number | Angka Tahun (misal: 2026) | 
| `KETERANGAN` | String | Catatan tambahan | 
| `CREATED_AT` | Timestamp | Waktu pembuatan | 

### 3. `MASTER_TIM`

| Kolom | Tipe Data | Keterangan | 
| ----- | ----- | ----- | 
| `ID_TIM` | String (UUID) | Primary Key | 
| `TAHUN_ID` | String (UUID) | Foreign Key -> `MASTER_TAHUN` | 
| `NAMA_TIM` | String | Nama Tim Kerja | 
| `KETERANGAN` | String | Catatan tambahan | 

### 4. `MASTER_KEGIATAN`

| Kolom | Tipe Data | Keterangan | 
| ----- | ----- | ----- | 
| `ID_KEGIATAN` | String (UUID) | Primary Key | 
| `TAHUN_ID` | String (UUID) | Foreign Key -> `MASTER_TAHUN` | 
| `TIM_ID` | String (UUID) | Foreign Key -> `MASTER_TIM` | 
| `NAMA_KEGIATAN` | String | Nama Kegiatan | 
| `SINGKATAN_KEGIATAN` | String | Kode / Singkatan | 

## ⚙️ Cara Instalasi & Deployment

### 1. Persiapan Database

1. Buat satu file **Google Sheets** baru di Google Drive Anda.
2. Buat tab/sheet sesuai dengan skema di atas (`MASTER_USER`, `MASTER_TAHUN`, `MASTER_TIM`, `MASTER_KEGIATAN`).

### 2. Setup Google Apps Script

1. Di Google Sheets, buka menu **Extensions (Ekstensi)** > **Apps Script**.
2. Buat file `.gs` dan `.html` sesuai dengan struktur projek di atas.
3. Salin kode skrip ke masing-masing file yang bersesuaian.

### 3. Deploy Web App

1. Di editor Google Apps Script, klik tombol **Deploy** (Penerapan) > **New Deployment** (Penerapan Baru).
2. Pilih tipe deployment: **Web App**.
3. Atur konfigurasi:
   * **Execute as**: `Me` (Akun Anda).
   * **Who has access**: `Anyone` (Siapa saja) atau `Anyone within your organization` (Sesuai kebutuhan).
4. Klik **Deploy**, berikan izin otorisasi Google jika diminta.
5. Salin **URL Web App** yang dihasilkan untuk mengakses aplikasi SIMANDOR di browser.

## 👨‍💻 Kontribusi & Pengembang

Dikembangkan dan dikelola secara modular untuk kemudahan skalabilitas dan pemeliharaan tim.

* **Developers**:
  * Al Munzir
  * Satria Firnanda

* **Lisensi**: Copyright © 2026 SIMANDOR. All rights reserved.