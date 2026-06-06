# Prompt untuk Codex

Saya ingin membuat aplikasi web yang benar-benar bisa dipakai, bukan mock-up, bernama **AEBT Regulatory Knowledge Hub**.

Tujuan aplikasi:
- Menjadi database regulasi dan SOP untuk SBU AEBT.
- Setiap regulasi/SOP memiliki metadata, file PDF, preview file, dan tombol download.
- File PDF disimpan di Supabase Storage.
- Metadata disimpan di Supabase Postgres.
- Web memiliki halaman home/dashboard, database regulasi, SOP center, detail dokumen, dan admin upload.

Stack yang digunakan:
- Next.js App Router + TypeScript.
- Supabase Postgres sebagai database.
- Supabase Storage sebagai repository file PDF.
- CSS sederhana tanpa UI library besar.

Fitur wajib:
1. Halaman Home menampilkan total dokumen, total regulasi, total SOP, prioritas tinggi, dan dokumen perlu review.
2. Halaman Database Regulasi menampilkan tabel dokumen dengan search dan filter berdasarkan tipe, kategori, dan status.
3. Halaman SOP Center menggunakan halaman dokumen yang sama dengan filter type=sop.
4. Halaman Detail Dokumen menampilkan metadata, service mapping, ringkasan, action point, preview PDF dengan iframe, tombol buka file, dan tombol download.
5. Halaman Admin Upload memiliki form untuk menambah regulasi/SOP baru.
6. Admin Upload harus menerima file PDF, upload ke Supabase Storage, lalu insert metadata ke tabel documents.
7. Setelah upload berhasil, sistem membuat catatan di tabel update_logs.
8. API upload dilindungi password sederhana via header `x-admin-password` yang dibandingkan dengan env `ADMIN_PASSWORD`.
9. File bucket Supabase bersifat private; preview dan download menggunakan signed URL dari server.
10. Aplikasi harus mudah dijalankan lokal dan deploy ke Vercel.

Skema database:
- Gunakan tabel `documents` dan `update_logs` sesuai file `supabase/schema.sql`.
- Gunakan private storage bucket bernama `regulatory-files`.

Tolong lanjutkan dan rapikan aplikasi ini. Prioritas perbaikan:
- Tambahkan fitur edit dokumen.
- Tambahkan fitur delete dokumen beserta file-nya.
- Tambahkan halaman update log.
- Tambahkan export CSV dari database.
- Tambahkan validasi form lebih baik.
- Tambahkan login Supabase Auth jika diperlukan untuk versi production.

Jangan ubah konsep utama. Pastikan semua fitur tetap berfungsi dengan Supabase dan file PDF benar-benar bisa dilihat serta di-download.
