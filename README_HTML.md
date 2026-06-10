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
6. Jalankan juga `supabase-service-catalog.sql` agar fitur Kelola Layanan
   menggunakan tabel `service_categories` dan `service_items`.
7. Untuk project lama, jalankan `supabase-add-standar-document-type.sql` agar
   kolom `documents.document_type` menerima nilai `standar`.
8. Jalankan `supabase-add-external-file-url.sql` agar dokumen dapat memakai
   PDF Supabase, link Google Drive/eksternal, atau disimpan tanpa file.

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

File `supabase-service-catalog.sql` membuat tabel `service_categories` dan
`service_items`, mengisi katalog layanan awal, mencegah nama duplikat,
mengaktifkan RLS, serta meminta PostgREST memuat ulang schema cache. Public user
hanya bisa membaca kategori dan sub-layanan aktif, sedangkan admin yang login
dengan Supabase Auth bisa menambah atau memperbarui data layanan.

Jika data dari versi Next.js sudah ada, `create table if not exists` tidak
menghapus data tersebut.

Migration `supabase-add-standar-document-type.sql` hanya mengganti check
constraint `document_type`. Data lama tetap dipertahankan dan nilai yang
diizinkan menjadi `regulasi`, `sop`, dan `standar`.

Migration `supabase-add-external-file-url.sql` menambahkan kolom
`external_file_url` dan `file_source`. Dokumen lama yang memiliki `file_path`
ditandai sebagai `supabase`; dokumen lama tanpa file ditandai sebagai `none`.

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

## 4. Kelola Layanan

1. Jalankan `supabase-service-catalog.sql` dari SQL Editor Supabase.
2. Login melalui menu **Admin**.
3. Untuk kategori baru, isi form **Tambah Kategori Layanan Baru**.
4. Untuk menambah sub-layanan, pilih kategori pada form **Tambah Sub-layanan**.
5. Isi nama sub-layanan lalu klik **Simpan sub-layanan**.

Kategori dan sub-layanan baru langsung muncul di:

- checklist **Layanan terkait** pada form tambah/edit dokumen;
- kartu **Service Mapping**;
- hitungan **Total kategori layanan** di Home.

Katalog utama disimpan di Supabase. Katalog di `app.js` hanya menjadi fallback
agar halaman publik tetap dapat dibuka sebelum migration dijalankan.

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

## 6. Sumber File Dokumen

1. Pastikan `supabase-html-schema.sql` sudah berhasil dijalankan.
2. Untuk database lama, jalankan `supabase-add-external-file-url.sql`.
3. Pastikan publishable/anon key sudah dimasukkan ke `app.js`.
4. Buka menu **Admin** dan login.
5. Isi metadata dokumen.
6. Pilih salah satu sumber file:
   - **Upload PDF ke Supabase**: pilih PDF, lalu simpan. File masuk ke bucket
     `regulatory-files` dan detail menampilkan preview serta download.
   - **Link Google Drive / eksternal**: isi URL `http://` atau `https://`.
     Tidak ada upload Storage dan detail menampilkan tombol **Buka File**.
   - **Tidak ada file untuk saat ini**: simpan langsung tanpa PDF atau link.
     Detail menampilkan **File belum tersedia**.
7. Periksa **Table Editor > documents** dan **update_logs**.
8. Buka detail dokumen dari Database Regulasi, SOP Center, Data Standar, atau
   Service Mapping.

## 7. Data Standar dan Perbaikan Tipe Dokumen

- **Database Regulasi** hanya menampilkan `document_type = regulasi`.
- **SOP Center** hanya menampilkan `document_type = sop`.
- **Data Standar** hanya menampilkan `document_type = standar`.
- Search, kategori, dan status tetap bekerja di dalam tipe pustaka aktif.

Untuk menambah standar:

1. Jalankan `supabase-add-standar-document-type.sql`.
2. Login melalui menu **Admin**.
3. Pilih **Standar** pada field **Tipe dokumen**.
4. Lengkapi metadata dan pilih sumber file sesuai kebutuhan, lalu simpan.
5. Buka menu **Data Standar** dan pastikan dokumen muncul.

Jika dokumen berada di menu yang salah, klik **Edit**, ubah **Tipe dokumen**
menjadi Regulasi, SOP, atau Standar, lalu simpan perubahan. Aplikasi tidak
menebak tipe berdasarkan judul.

## 8. Edit dan Hapus

Setelah login:

- tombol **Edit** mengisi form dengan metadata dokumen;
- PDF baru bersifat opsional saat edit;
- file Supabase lama tetap digunakan jika sumber file tetap Supabase dan tidak
  ada PDF baru;
- admin dapat mengganti sumber file menjadi link eksternal atau tanpa file;
- mengganti sumber file tidak otomatis menghapus objek lama dari Storage;
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
