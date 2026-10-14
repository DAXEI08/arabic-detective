# Arabic Detective — المُحَقِّقُ اللُّغَوِيُّ

> **Pahami petunjuk. Hubungkan bukti. Pecahkan kasus dengan bahasa Arab.**

Game investigasi interaktif untuk siswa SMK pemula bahasa Arab. Siswa memecahkan 5 kasus di pelabuhan (tema *السَّفَرُ عَبْرَ الْمِينَاءِ*) dengan mengamati adegan, membaca petunjuk Arab, mengumpulkan bukti, dan menarik kesimpulan. Loop belajar: **Observe → Read → Interpret → Connect → Decide → Solve**.

## Fitur
- 5 kasus berjenjang, tiap kasus memperkenalkan mekanik baru: hotspot adegan · penempatan peta (seret/ketuk) · kartu saksi + penempatan tokoh · **Papan Bukti** (pilah, sematkan, hubungkan, eliminasi) · inspeksi lokasi + kronologi + laporan akhir.
- **Dalil (دَلِيل)** — asisten petunjuk 3 tingkat (umum → spesifik → linguistik) yang tidak pernah membocorkan jawaban. Mode Demo/offline deterministik + adapter untuk LLM nyata.
- XP, bintang (akurasi + pemakaian petunjuk, tanpa hukuman berlebihan), 3 peringkat, 4 pencapaian.
- **Mode Guru**: dasbor dari data bermain lokal (progres, akurasi, hint, XP, *Kosakata Paling Sulit*, ekspor CSV).
- Responsif (≥360px), keyboard/touch/mouse, ARIA, target sentuh ≥44px, dukungan *reduced motion*, tanpa audio.
- Progres tersimpan lokal; sesi kasus yang berjalan dipulihkan saat reload; data korup diperbaiki otomatis.

## Menjalankan
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc + vite build → dist/
npm run preview
npm test           # 28 tes: konten, mesin, persistensi, state machine 5 kasus, render semua task
npm run verify     # verifikasi konten: semua kasus konsisten & dapat diselesaikan; semua kata Arab ada di leksikon
```

## Arsitektur
```
src/
  app/            router + guards
  components/
    common/       Button, Sheet, Modal, Toasts, DragItem (seret + ketuk), RichText (Arab otomatis RTL)
    game/         EntityIcon (SVG), HarborScene, GridMap, CaseRunner, Briefing, SolvedScreen
      tasks/      satu komponen per tipe task + registry (index.tsx)
    evidence/     EvidenceCard, NotesSheet
    ai/           DalilPanel
  data/           vocabulary, lexicon (glossing Arab), achievements, cases/case1..5 (data-driven)
  engine/         spatial (relasi أمام/خلف/…), scoring, analytics, achievements, verifyContent
  services/       persistence (storage abstraction + sanitizer), ai (offline + remote adapter)
  stores/         playerStore (persisten), gameStore (sesi kasus), uiStore (toast)
  pages/          Landing, Setup, Tutorial, CaseSelect, CasePage, Results, Achievements, Teacher, Settings
```
Keputusan utama:
- **Konten berbasis data.** `CaseDefinition` berisi `clues` + `tasks` (union bertipe: hotspot, scene-choice, placement, dialogue, assign, board, elimination, sequence, inspect, report). Engine tidak terikat tema pelabuhan; paket tema baru (Sekolah, Pasar, …) cukup menambah data + ikon.
- **Semantik spasial dihitung**, bukan jawaban tetap: pemain boleh menempatkan di sel mana pun yang memenuhi petunjuk. Peta menghadap ke bawah (▼ dermaga): `أَمَامَ` = sel tepat di bawah, `خَلْفَ` = di atas, `بِجَانِبِ` = kiri/kanan, `بَيْنَ` = di antara dua jangkar sebaris, `فِي` = sel sama, `قُرْبَ` = ≤ 2 sel.
- Interaksi seret selalu punya **alternatif ketuk/keyboard** (pilih benda → pilih tujuan).
- **Leksikon Dalil**: kalimat Arab di-*gloss* per kata secara deterministik (termasuk frasa idafa), sehingga "Jelaskan kalimat/kata" bekerja offline untuk seluruh konten.

## Penyimpanan progres
`localStorage` lewat `services/persistence/storage.ts` (fallback memori bila diblokir). Kunci:
- `arabic-detective:v1:state` — semua siswa, progres per kasus, statistik kosakata, pencapaian, pengaturan.
- `arabic-detective:v1:session` — sesi kasus yang sedang berjalan (dipulihkan saat reload).

Data dibaca lewat `sanitizeState` sehingga JSON korup/versi lama tidak membuat aplikasi crash. Untuk pindah ke IndexedDB cukup ganti modul `storage.ts`.

## Arsitektur AI
| Mode | Kapan | Perilaku |
|---|---|---|
| **Demo / Offline** (default) | `VITE_AI_ENABLED` kosong/false | Petunjuk tertulis 3 tingkat yang adaptif (berdasarkan kasus, tugas, jumlah salah, bukti terkumpul) + glossing leksikon. Tidak butuh internet. |
| **AI nyata** | `VITE_AI_ENABLED=true` + `VITE_AI_ENDPOINT` | `services/ai/remoteProvider.ts` memanggil *proxy server Anda*. Jika gagal/timeout (9 dtk) otomatis jatuh ke mode offline. |

Variabel lingkungan (`.env.example`):
```env
VITE_AI_ENABLED=false
VITE_AI_ENDPOINT=/api/dalil
```
**Jangan menaruh API key di variabel `VITE_*`** — semuanya masuk ke bundel browser. Produksi harus memakai proxy server/serverless yang menyimpan key. Kontrak:
```
POST /api/dalil  { system, action, context }  →  { "reply": "..." }
```
`system` berisi `DALIL_SYSTEM_PROMPT` (`services/ai/prompt.ts`: aturan 3 tingkat, tidak boleh membocorkan jawaban). `context` (`DalilContext`) sengaja **tidak memuat kunci jawaban**. Contoh proxy (Vercel/Node, ringkas):
```ts
export default async function handler(req, res) {
  const { system, action, context } = req.body
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify({ action, context }) }] }),
  })
  const j = await r.json()
  res.json(JSON.parse(j.choices[0].message.content))
}
```
Titik integrasi di frontend: **`src/services/ai/index.ts`** (`askDalil`).

## Deploy
`npm run build` → sajikan `dist/` sebagai situs statis. Karena memakai BrowserRouter, host harus mengarahkan semua path ke `index.html` (sudah disertakan: `public/_redirects` untuk Netlify, `vercel.json` untuk Vercel). Font memakai Google Fonts dengan fallback sistem; tanpa internet Arab tetap tampil dengan font serif sistem.

## Menambah kasus / paket tema
1. Tambah kosakata di `data/vocabulary.ts` (+ kata bantu di `data/lexicon.ts`) dan ikon di `components/game/EntityIcon.tsx`.
2. Buat `data/cases/caseN.ts` (`CaseDefinition`): `clues` (kalimat Arab berharakat + catatan Indonesia), `tasks` (pilih tipe task, tulis 3 `hints`, `success`).
3. Daftarkan di `data/cases/index.ts`.
4. Jalankan `npm run verify` — memastikan setiap placement dapat diselesaikan, setiap eliminasi punya bukti, dan setiap kata Arab dapat dijelaskan Dalil.
5. Tipe task baru: tambahkan ke union di `types/index.ts`, buat komponen di `components/game/tasks/`, daftarkan di `tasks/index.tsx`.

## Skema skor
Tiap tugas benar +100 XP (+30 bila tanpa petunjuk Dalil); selesai kasus +150; +50 per bintang. Akurasi = tugas benar / (tugas benar + kesalahan). ⭐⭐⭐ bila akurasi ≥ 85% dan petunjuk ≤ 3; ⭐⭐ bila ≥ 60%; selain itu ⭐. XP total = XP terbaik per kasus (replay tidak bisa digrinding). Peringkat: 0 / 1.500 / 3.500 XP.

## Keterbatasan
- Data guru hanya dari perangkat/browser yang sama (sengaja tanpa cloud/login).
- Teks Arab sebaiknya ditinjau guru bahasa Arab sebelum dipakai di kelas.
