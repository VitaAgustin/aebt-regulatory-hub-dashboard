# AEBT Regulatory Knowledge Hub

Versi produksi saat ini adalah aplikasi static `index.html`, `styles.css`, dan
`app.js`. Panduan lengkap tersedia di `README_HTML.md`.

## Fitur

- Dashboard jumlah dokumen, regulasi, SOP, prioritas tinggi, dan dokumen perlu review.
- Database regulasi dengan search/filter.
- SOP Center dengan filter dokumen SOP.
- Detail dokumen dengan metadata, service mapping, preview PDF, dan tombol download.
- Admin upload dokumen PDF.
- File PDF tersimpan di private bucket Supabase Storage.
- Preview/download memakai signed URL dari server.
- Update log otomatis saat dokumen ditambahkan.

## Stack

- HTML, CSS, dan JavaScript vanilla
- Supabase Database, Storage, Auth, dan RPC
- Vercel static hosting

## Setup

### 1. Buat project Supabase

Buat project baru di Supabase, lalu buka SQL Editor.

### 2. Jalankan schema

Copy isi file:

```text
supabase/schema.sql
```

Jalankan di Supabase SQL Editor.

Opsional: jalankan `supabase/seed.sql` untuk sample data tanpa file.

### 3. Ambil konfigurasi publik Supabase

Di Supabase Dashboard, ambil:

- Project URL
- Publishable key atau legacy anon key

Hanya konfigurasi publik tersebut dan nama bucket yang boleh berada di
frontend. Jangan menaruh privileged server key, database password, JWT signing
secret, atau password portal di source code.

### 4. Konfigurasi frontend

Atur `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `STORAGE_BUCKET` di bagian paling
atas `app.js`. Jangan membuat `.env.local` berisi secret untuk static frontend.

### 5. Install dependency

```bash
npm install
```

Jalankan audit keamanan sebelum build:

```bash
npm run security:audit
```

### 6. Jalankan lokal

```bash
npm run dev
```

Buka:

```text
http://localhost:3000
```

### 7. Tambahkan dokumen

Buka:

```text
http://localhost:3000/admin
```

Masukkan password sesuai `ADMIN_PASSWORD`, isi metadata, upload PDF, lalu simpan.

### 8. Cek file

Setelah upload berhasil:

- buka halaman Database Regulasi atau SOP Center;
- klik detail dokumen;
- cek preview PDF;
- klik download.

## Struktur folder penting

```text
app/
  admin/
  api/documents/
  documents/
components/
  AdminUploadForm.tsx
lib/
  helpers.ts
  queries.ts
  supabaseAdmin.ts
  types.ts
supabase/
  schema.sql
  seed.sql
```

## Catatan keamanan MVP

Untuk kebutuhan OJT, API admin dilindungi password sederhana melalui environment variable. Untuk production internal yang lebih aman, disarankan menambahkan Supabase Auth, role admin, dan audit log yang lebih lengkap.

## Saran pengembangan berikutnya

- Edit dokumen.
- Delete dokumen + hapus file storage.
- Halaman update log.
- Export CSV.
- Import bulk regulasi dari CSV.
- Login Supabase Auth.
- Reminder review regulasi bulanan.
