# AEBT Regulatory Knowledge Hub - HTML Version

Versi ini adalah single-page application static berbasis:

- `index.html`
- `styles.css`
- `app.js`
- Supabase JavaScript client v2 dari CDN
- Supabase Database, Storage, dan Auth

Versi Next.js lama tetap ada dan tidak diperlukan untuk menjalankan versi
static.

## 1. Konfigurasi Supabase

Buka `app.js`, lalu ubah tiga konstanta paling atas:

```js
const SUPABASE_URL = "https://PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_...";
const STORAGE_BUCKET = "regulatory-files";
```

Nilai tersebut tersedia di Supabase Dashboard:

1. Buka **Project Settings**.
2. Buka **API Keys**.
3. Salin **Project URL**.
4. Salin **Publishable key** atau legacy **anon key**.

Jangan pernah memasukkan `service_role`, secret key, atau database password ke
`app.js`, HTML, repository publik, maupun static hosting.

## 2. Menjalankan SQL

1. Buka project Supabase.
2. Masuk ke **SQL Editor**.
3. Buat query baru.
4. Salin seluruh isi `supabase-html-schema.sql`.
5. Klik **Run**.
6. Buat query baru, salin seluruh isi `supabase-service-catalog.sql`, lalu
   klik **Run**.

Script tersebut:

- membuat atau mempertahankan tabel `documents`;
- membuat atau mempertahankan tabel `update_logs`;
- membuat trigger `updated_at`;
- mengaktifkan RLS;
- memberi public read access pada `documents`;
- memberi authenticated write access pada `documents`;
- memberi authenticated read/insert access pada `update_logs`;
- membuat private bucket `regulatory-files`;
- mengizinkan public membuat signed URL untuk file;
- mengizinkan authenticated user upload, update, dan delete file.

File `supabase-service-catalog.sql`:

- membuat tabel `service_categories` dan `service_items`;
- memasukkan delapan kategori awal beserta sub-layanannya;
- memberi public read access hanya untuk layanan aktif;
- memberi authenticated user akses tambah dan edit katalog;
- menggunakan `is_active` untuk menonaktifkan data tanpa menghapus riwayat.

Jika data dari versi Next.js sudah ada, `create table if not exists` tidak
menghapus data tersebut.

## 3. Membuat Admin User

Untuk model keamanan sederhana ini, setiap permanent authenticated user
dianggap sebagai admin. Karena itu public sign-up harus dinonaktifkan.

1. Buka **Authentication > Providers > Email**.
2. Pastikan email/password aktif.
3. Nonaktifkan opsi yang mengizinkan user publik melakukan sign-up.
4. Buka **Authentication > Users**.
5. Klik **Add user** atau **Create new user**.
6. Masukkan email admin dan password kuat.
7. Tandai email sebagai confirmed jika opsi tersebut tersedia.

Admin kemudian login dari menu **Admin** pada aplikasi.

## 4. Mengelola Katalog Layanan

Setelah login, buka **Admin > Kelola Layanan**.

- Gunakan form **Tambah kategori** untuk membuat kategori utama.
- Gunakan form **Tambah sub-layanan** untuk memilih kategori dan menambahkan
  layanan di bawahnya.
- Tombol **Edit** mengubah nama atau deskripsi.
- Tombol **Nonaktifkan** menyembunyikan layanan dari form dokumen dan Service
  Mapping publik tanpa menghapus data lama.
- Tombol **Aktifkan** menampilkan kembali kategori atau sub-layanan.

Form tambah/edit dokumen dan halaman Service Mapping selalu membaca katalog
terbaru dari Supabase. Nilai pilihan dokumen tetap disimpan pada kolom
`documents.related_services` sebagai string yang dipisahkan koma.

## 5. Menjalankan Web

File dapat dibuka langsung melalui `index.html`, tetapi local static server
lebih konsisten untuk Auth dan debugging.

Contoh dengan Python:

```powershell
python -m http.server 8080
```

Buka:

```text
http://127.0.0.1:8080
```

Alternatif static hosting:

- GitHub Pages
- Netlify
- Vercel Static
- Cloudflare Pages
- web server internal perusahaan

Tambahkan URL hosting ke **Authentication > URL Configuration > Redirect
URLs** jika nantinya menambahkan email confirmation, password reset, atau
magic-link flow.

## 6. Mengetes Upload PDF

1. Pastikan `supabase-html-schema.sql` sudah berhasil dijalankan.
2. Pastikan publishable/anon key sudah dimasukkan ke `app.js`.
3. Buka menu **Admin**.
4. Login memakai admin user Supabase Auth.
5. Isi judul, tipe dokumen, kategori, dan metadata lain.
6. Pilih file PDF.
7. Klik **Simpan dokumen**.
8. Buka Supabase **Storage > regulatory-files** dan pastikan file muncul.
9. Buka **Table Editor > documents** dan pastikan metadata muncul.
10. Buka **Table Editor > update_logs** dan pastikan log "Tambah dokumen"
    muncul.
11. Kembali ke menu **Database Regulasi** atau **SOP Center**.
12. Buka detail dokumen dan cek preview serta tombol download.

## 7. Edit dan Hapus

Setelah login:

- tombol **Edit** mengisi form dengan metadata dokumen;
- PDF baru bersifat opsional saat edit;
- jika PDF baru dipilih, file lama akan dicoba dihapus setelah update sukses;
- tombol **Hapus** menghapus metadata, membuat update log, dan mencoba
  menghapus file Storage;
- setiap operasi akan ditolak oleh RLS jika session Auth tidak aktif.

## Catatan Keamanan

- Bucket tetap private.
- Public user hanya mendapat signed URL berdurasi satu jam.
- Anon key aman digunakan di frontend selama RLS benar.
- Semua perlindungan tulis berasal dari RLS, bukan dari menyembunyikan tombol.
- Nonaktifkan anonymous sign-in dan public sign-up agar role `authenticated`
  hanya diberikan kepada akun admin yang memang dibuat secara manual.
