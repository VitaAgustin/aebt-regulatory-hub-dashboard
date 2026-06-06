# AEBT Regulatory Knowledge Hub

Web database regulasi dan SOP untuk SBU AEBT. Aplikasi ini menyimpan metadata dokumen di Supabase Postgres dan file PDF di Supabase Storage, sehingga file benar-benar bisa dilihat dan di-download.

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

- Next.js App Router
- TypeScript
- Supabase Postgres
- Supabase Storage

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

### 3. Ambil environment variable Supabase

Di Supabase Dashboard, ambil:

- Project URL
- Service Role Key

Service role key hanya boleh disimpan di server/env, jangan dimasukkan ke frontend publik.

### 4. Buat `.env.local`

Copy `.env.example` menjadi `.env.local`:

```bash
cp .env.example .env.local
```

Isi:

```env
NEXT_PUBLIC_APP_NAME="AEBT Regulatory Knowledge Hub"
SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
SUPABASE_STORAGE_BUCKET="regulatory-files"
ADMIN_PASSWORD="password-admin-yang-kuat"
```

### 5. Install dependency

```bash
npm install
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
