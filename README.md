# ♠️ Poker Tongkrongan Online (Aturan Kumpul 3 & Bom Poker)

Aplikasi web game kartu multiplayer (2 - 4 pemain) menggunakan **Next.js (App Router + TypeScript + Tailwind CSS)** dan **Supabase Realtime**, siap di-deploy ke **Vercel**.

---

## ✨ Fitur & Aturan Permainan Khas Tongkrongan

1. **Fase Pembuka Kumpul Angka 3:**
   - Pada awal permainan, setelah kocok ulang (*redeal*), atau setelah ronde berakhir karena **BOM**, seluruh pemain wajib mengumpulkan semua kartu angka `3` ke meja.
   - Pemain yang mengeluarkan **`3 Sekop (3♠)`** mendapat giliran jalan paling pertama!
   - Jika ronde berakhir normal (tanpa Bom), di ronde berikutnya **Juara 1 langsung jalan pertama** (bebas mengeluarkan kombinasi apa saja) tanpa perlu kumpul angka 3.
2. **Urutan Kekuatan & Kombinasi Kartu:**
   - Urutan nilai kartu: `3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2 (Poker)`.
   - Lambang (`♠ ♥ ♣ ♦`) setara dalam adu kartu, sehingga hanya bisa dilawan dengan **angka yang lebih tinggi**.
   - Kombinasi yang didukung:
     - **Single (1 Kartu)**
     - **Double (2 Kartu Kembar)**
     - **Triple (3 Kartu Kembar)**
     - **Seri Sejenis (Straight Flush ≥ 3 Kartu):** Harus lambang yang sama (misal `3♠ 4♠ 5♠`), dapat dilawan dengan jumlah kartu seri yang sama dengan angka lebih tinggi walau beda lambang (misal `4♥ 5♥ 6♥`).
     - **Full House (5 Kartu: 3 Kembar + 2 Kembar Buntut):** Contoh `4-4-4 + 3-3`.
3. **Mekanisme BOM (Khusus Melawan 1 Kartu Poker / Single `2`):**
   - Jika ada pemain yang mengeluarkan **1 kartu Poker (Single `2`)**, pemain lain dapat memotong dengan **BOM**:
     - **4 Kartu Kembar Lengkap** (contoh: `3♠ 3♥ 3♣ 3♦`)
     - **5 Kartu Seri Sejenis** (contoh: `3♠ 4♠ 5♠ 6♠ 7♠`)
   - *(Double / Triple Poker tidak bisa di-bom)*.
   - Saat terjadi BOM, permainan langsung berakhir! **Pengebom `+10`**, **Korban Bom `-10`**, **Pemain lain `0`**, dan ronde selanjutnya kembali kumpul angka 3.
4. **Kocok Ulang Otomatis (Redeal Batal Tanpa Poin):**
   - Jika saat pembagian 52 kartu ada pemain yang **tidak mendapat kartu Kerajaan (`J, Q, K`) sama sekali**, atau ada 1 pemain yang **memegang keempat kartu Poker (`2`) sekaligus**, kartu otomatis dikocok ulang dan kembali ke Fase Kumpul Angka 3.
5. **Pengocokan Kartu Adil Setara Dunia Nyata (Anti-Repeat CSPRNG):**
   - Menggunakan `crypto.getRandomValues` (CSPRNG) di sisi server + simulasi *Overhand, Riffle Shuffle, Cut Deck*, dan *Anti-Similarity Guard* agar pemain tidak mendapatkan pola kartu yang berulang di ronde berikutnya.

---

## 🚀 Cara Menjalankan di Komputer Lokal

```bash
npm install
npm run dev
```
Buka `http://localhost:3000` di browser.
- Kamu bisa langsung klik **"Langsung Main Lawan Bot Pintar (4 / 3 / 2 Pemain)"** untuk menguji seluruh aturan permainan.
- Kamu juga bisa membuat Room, lalu membuka beberapa Tab Browser di `http://localhost:3000` dan memasukkan **Kode Room** yang sama untuk menguji multiplayer antar-tab secara langsung!

---

## 🌐 Cara Menghubungkan Supabase & Deploy ke Vercel

1. Buat project baru di [Supabase](https://supabase.com).
2. Buka menu **SQL Editor** di Dashboard Supabase, lalu salin dan jalankan isi file [`supabase/schema.sql`](./supabase/schema.sql).
3. Salin `Project URL` dan `anon public key` dari menu **Project Settings -> API** di Supabase.
4. Buat file `.env.local` (atau masukkan di **Environment Variables** saat deploy ke **Vercel**):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://project-kamu.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...
   ```
5. Push repository ke GitHub dan import ke [Vercel](https://vercel.com) — aplikasi siap dimainkan online lintas perangkat bersama teman-temanmu!

