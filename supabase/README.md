# Supabase setup — Arabic Detective

Fitur ini membuat nilai siswa tersimpan lintas perangkat dan menyediakan dashboard guru dengan login email/password.

## 1. Buat project Supabase

Buat project di Supabase, lalu buka **SQL Editor** dan jalankan seluruh isi `supabase/schema.sql`.

Skema membuat:

- `students`: identitas siswa (ID lokal, nama, kelas).
- `attempts`: setiap pengerjaan kasus, termasuk nilai, akurasi, benar/salah, hint, XP, bintang, bukti, durasi, waktu, dan detail JSON.
- `teacher_accounts`: allowlist akun Auth yang boleh membaca data siswa.
- RPC `submit_attempt`: endpoint aman yang dipakai siswa untuk mengirim hasil.
- RLS: siswa/anon tidak dapat membaca daftar nilai; hanya akun guru yang terdaftar.

## 2. Buat akun guru

Di Supabase buka **Authentication → Users → Add user**, masukkan email dan password guru.

Salin UUID user tersebut, lalu jalankan di SQL Editor:

```sql
insert into public.teacher_accounts(user_id)
values ('UUID-AKUN-GURU');
```

Untuk guru tambahan, buat Auth user baru dan tambahkan UUID-nya ke tabel yang sama.

## 3. Tambahkan environment variables di Vercel

Dari **Supabase → Project Settings → API**, ambil Project URL dan anon/public key.

Di Vercel buka **Project → Settings → Environment Variables** dan tambahkan:

```text
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Gunakan anon/public key saja. Jangan pernah memasukkan `service_role` key ke variabel `VITE_*` karena nilai Vite tersedia di browser.

Setelah itu lakukan **Redeploy**.

## 4. Alur penggunaan

Siswa:

1. Membuka aplikasi.
2. Mengisi nama dan kelas.
3. Menyelesaikan kasus.
4. Hasil tetap disimpan lokal dan juga dikirim ke Supabase.
5. Jika pengiriman gagal karena koneksi, payload masuk antrean lokal dan dicoba lagi pada pengiriman berikutnya.

Guru:

1. Buka `/teacher`.
2. Login menggunakan akun Supabase Auth yang sudah dimasukkan ke `teacher_accounts`.
3. Lihat semua pengerjaan dari semua perangkat.
4. Cari/filter berdasarkan siswa atau kelas.
5. Klik pengerjaan untuk melihat detail.
6. Ekspor data terfilter ke CSV.

## Data yang dikirim

Setiap pengerjaan menyimpan:

- nama dan kelas siswa;
- kasus dan nomor percobaan;
- nilai 0–100 dan akurasi;
- jumlah benar, salah, dan penggunaan hint;
- XP dan bintang;
- bukti ditemukan / total bukti;
- durasi, waktu mulai, waktu selesai;
- statistik kosakata;
- evidence/revealed/learned;
- statistik tiap task yang tersedia di game.

Catatan: versi game saat ini tidak menyimpan teks/pilihan jawaban salah secara global untuk setiap jenis task. Karena itu cloud menyimpan seluruh telemetry yang memang tersedia di engine saat hasil dibuat, bukan data yang tidak pernah direkam oleh task component.
