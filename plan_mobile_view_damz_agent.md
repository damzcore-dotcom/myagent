# Rencana Implementasi — Tampilan Mobile Responsif & APK Ready (Damz Agent v2.2)

Rencana ini dibuat untuk memodifikasi antarmuka web **Damz Agent** agar responsif terhadap perangkat mobile (smartphone/tablet) dan siap dikemas (packaged) menjadi aplikasi Android (.APK) menggunakan framework hybrid seperti **Capacitor** atau **Cordova** (WebView).

---

## 📱 1. Kebutuhan Desain Mobile (UX/UI Spec)

Tampilan desktop saat ini menggunakan layout grid 2-kolom dengan sidebar statis 260px. Untuk mobile, kita akan menerapkan adaptasi berikut:

1. **Top Bar Mobile (Header)**: Header kecil yang muncul di layar lebar `< 768px` dengan tombol hamburger untuk membuka Sidebar Drawer, indikator status ringkas, dan nama model yang aktif.
2. **Sidebar Drawer (Slide-out)**: Sidebar desktop berubah menjadi overlay drawer yang tersembunyi secara default dan muncul dari sisi kiri dengan animasi geser (*slide-in*).
3. **Bottom Navigation (Alternatif Terbaik untuk APK)**: Memindahkan menu navigasi utama ke bagian bawah layar untuk kemudahan akses satu tangan khas aplikasi mobile natif.
4. **Touch Targets & Gestures**: Mengoptimalkan tombol agar memiliki ukuran sentuh minimal `44x44 px` dan menonaktifkan seleksi teks tidak sengaja (`user-select: none`).
5. **Safe Area Insets**: Mendukung area layar berponi (notch) menggunakan CSS `safe-area-inset`.

---

## 🛠️ 2. Proposed Changes

### A. Viewport & HTML Base
#### [MODIFY] [index.html](file:///c:/ADAM/myagent/frontend/index.html)
* Ubah meta viewport untuk mengunci skala zoom dan mendukung area aman layar berponi:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  ```
* Tambahkan elemen kontainer header mobile di atas tata letak utama:
  ```html
  <header id="mobile-header" class="mobile-header"></header>
  ```

---

### B. CSS Layout & Responsiveness
#### [MODIFY] [layout.css](file:///c:/ADAM/myagent/frontend/css/layout.css)
* Tambahkan media query `@media (max-width: 768px)` untuk mengatur ulang layout:
  * `.app-layout`: Diubah dari `grid-template-columns: var(--sidebar-width) 1fr` menjadi satu kolom (`display: block` atau `grid-template-columns: 1fr`).
  * `.sidebar`: Posisi diubah dari `sticky` menjadi `fixed; top: 0; left: -100%; width: 280px; height: 100vh; z-index: 999; transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);` (menjadi Drawer).
  * `.sidebar.open`: Ditambahkan class `.open` untuk menggeser sidebar ke layar (`left: 0;`).
  * Tambahkan `.sidebar-overlay`: Latar belakang gelap semi-transparan untuk menutup konten utama saat sidebar terbuka.
  * `.main-content`: Padding atas disesuaikan dengan tinggi header mobile (`margin-top: 56px;`).
* Tambahkan CSS safe area untuk mencegah konten terpotong pada smartphone berponi:
  ```css
  :root {
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
  }
  ```

---

### C. Pages Responsiveness (Flexbox & Grid Adjustments)
#### [MODIFY] [pages.css](file:///c:/ADAM/myagent/frontend/css/pages.css)
* **Dashboard**:
  * Ubah grid statis `.dashboard-grid` dari 4 kolom menjadi 1 kolom pada mobile, dan 2 kolom pada tablet.
  * Susun ulang urutan kartu: Status Panel (TTS LED) & Waveform di posisi paling atas, diikuti oleh circular gauges, baru kemudian activity feed.
* **Chat**:
  * Pindahkan input chat ke posisi menempel di bawah layar dengan padding safe area: `padding-bottom: calc(var(--space-4) + var(--safe-bottom));`.
  * Sembunyikan tombol micro-settings popover di belakang aksi tekan lama (long press) atau letakkan berdampingan secara rapi pada layar kecil.
* **Knowledge**:
  * Sederhanakan data-table pada layar sempit dengan mengubah format baris menjadi berbentuk kartu (cards) agar data file, ukuran, dan tombol aksi re-index/delete tidak terpotong.
* **Vision & Tools**:
  * Grid tools diubah menjadi 1 kolom.
  * Grid unggah gambar & hasil analisis OCR diubah dari flex-row berdampingan menjadi flex-column vertikal.

---

### D. Interaksi JavaScript (Mobile Drawer & Navigation)
#### [MODIFY] [app.js](file:///c:/ADAM/myagent/frontend/js/app.js)
* Buat modul inisialisasi menu mobile:
  ```javascript
  function initMobileMenu() {
    const header = document.getElementById('mobile-header');
    if (header) {
      header.innerHTML = `
        <button class="hamburger-btn" id="mobile-hamburger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <span class="mobile-header-title">DAMZ AGENT</span>
        <span class="status-dot status-dot--ready"></span>
      `;
    }

    const hamburger = document.getElementById('mobile-hamburger');
    const sidebar = document.getElementById('sidebar');
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay hidden';
    document.body.appendChild(overlay);

    hamburger.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('hidden');
    });

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.add('hidden');
    });

    // Close drawer when routing occurs
    window.addEventListener('hashchange', () => {
      sidebar.classList.remove('open');
      overlay.classList.add('hidden');
    });
  }
  ```

---

## 📱 3. APK Packaging Readiness Checklist

Untuk membungkus aplikasi web ini menjadi APK Android yang berkinerja tinggi, beberapa modifikasi teknis berikut harus dipersiapkan:

### 1. Dynamic Server Host (Sangat Penting)
* **Masalah**: WebView pada APK menganggap `localhost` adalah perangkat smartphone itu sendiri, sehingga fetch ke `http://localhost:3001` akan gagal karena server backend berjalan di PC/Server eksternal.
* **Solusi**: 
  1. Halaman login/koneksi harus mendeteksi secara dinamis apakah aplikasi berjalan di dalam APK.
  2. Tambahkan pengaturan **Server IP Address** global di awal (bisa diintegrasikan dengan halaman Login atau Setup awal aplikasi) dan disimpan ke `localStorage`.
  3. Ganti URL absolut di JavaScript dari `http://localhost:3001` menjadi variabel dynamic server host:
     ```javascript
     const getBackendURL = () => localStorage.getItem('damz_backend_url') || 'http://localhost:3001';
     ```

### 2. Cegah Gestur Browser Bawaan (Web-View Glitches)
* Tambahkan aturan CSS berikut pada body untuk mencegah aksi tarik-untuk-menyegarkan (*pull-to-refresh*) dan geser-kembali (*swipe-to-back*) bawaan WebView yang dapat merusak alur SPA:
  ```css
  html, body {
    overscroll-behavior-y: contain;
    overscroll-behavior-x: none;
    -webkit-tap-highlight-color: transparent;
  }
  ```

### 3. Build & Package dengan Capacitor (Rekomendasi)
Capacitor oleh Ionic merupakan alat modern terbaik untuk membungkus kode HTML/CSS/JS murni ini. Langkah-langkahnya:
1. Inisialisasi npm project pada root: `npm init -y`
2. Install Capacitor CLI & Core: `npm install @capacitor/core @capacitor/cli`
3. Inisialisasi aplikasi Capacitor: `npx cap init "Damz Agent" "com.damz.agent"` (arahkan web dir ke folder `frontend`).
4. Tambahkan platform Android: `npm install @capacitor/android && npx cap add android`
5. Setiap kali ada perubahan di folder `frontend`, lakukan sinkronisasi: `npx cap sync`
6. Buka Android Studio untuk build APK: `npx cap open android`

---

## 📈 4. Rencana Verifikasi

### Pengujian Responsivitas (Browser Emulator):
1. Aktifkan mode responsif di Google Chrome DevTools (pilih profil perangkat Mobile S, M, L, serta tablet).
2. Verifikasi Sidebar Drawer dapat dibuka dengan tombol hamburger dan ditutup dengan mengeklik overlay latar belakang.
3. Verifikasi tata letak dashboard menyusun kartu secara vertikal tanpa adanya luapan horizontal (*horizontal scrollbar*).
4. Pastikan form input chat tetap menempel dengan rapi di bagian bawah viewport saat keyboard virtual mobile diaktifkan.

### Pengujian APK Ready (Android WebView):
1. Build file HTML/CSS/JS menggunakan emulator perangkat virtual Android Studio.
2. Uji fungsionalitas fetch API dengan memasukkan IP Address lokal komputer host yang menjalankan backend Server Express (misalnya `http://192.168.1.100:3001`).
3. Pastikan tidak ada tombol atau link yang memicu browser eksternal bawaan HP terbuka secara otomatis.
