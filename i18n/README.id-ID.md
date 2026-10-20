<div align="center">

<img src="../images/banner.png" alt="Bansur Router" width="880"/>

**Satu endpoint untuk semua provider AI.**

[![npm](https://img.shields.io/npm/v/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Downloads](https://img.shields.io/npm/dm/bansur-router.svg)](https://www.npmjs.com/package/bansur-router)
[![Docker Pulls](https://img.shields.io/docker/pulls/bansur/router.svg?logo=docker&label=Docker%20pulls)](https://hub.docker.com/r/bansur/router)
[![Docker Version](https://img.shields.io/docker/v/bansur/router?logo=docker&label=Docker%20version)](https://hub.docker.com/r/bansur/router)
[![GHCR](https://img.shields.io/badge/GHCR-mas-ajam%2Fbansur-router-blue?logo=github)](https://github.com/mas-ajam/bansur-router/pkgs/container/bansur-router)
[![License](https://img.shields.io/npm/l/bansur-router.svg)](https://github.com/mas-ajam/bansur-router/blob/main/LICENSE)

[Mulai Cepat](#mulai-cepat) · [Fitur Utama](#fitur-utama) · [Provider](#provider-yang-didukung) · [Panduan Setup](#panduan-setup) · [Dokumentasi](https://bansur-router.pages.dev)

[🇧🇷 Português (Brasil)](./README.pt-BR.md) • [🇻🇳 Tiếng Việt](./README.vi.md) • [🇨🇳 中文](../README.zh-CN.md) • [🇯🇵 日本語](./README.ja-JP.md) • [🇷🇺 Русский](./README.ru.md) • [🇹🇭 ไทย](./README.th.md) • [🇮🇷 فارسی](./README.fa_IR.md) • [🇮🇩 Indonesia](./README.id-ID.md) • [🇪🇸 Español](./README.es.md) • [🇫🇷 Français](./README.fr.md)

</div>

---

# Bansur Router

Bansur Router adalah gateway AI lokal untuk tool coding. Ia berjalan di mesin Anda sendiri dan menghadirkan satu endpoint yang kompatibel dengan OpenAI — `http://localhost:667/v1` — di depan setiap provider yang Anda hubungkan ke dalamnya.

Konfigurasikan tool Anda sekali saja. Setelah itu, Bansur Router menangani koneksi provider di balik endpoint tersebut: akun mana yang menjawab sebuah request, bagaimana format request diterjemahkan, berapa kuota yang tersisa, dan apa yang terjadi ketika sebuah provider menolak. Langganan yang sudah Anda bayar dipakai terlebih dahulu, API yang lebih murah mengambil alih ketika kuotanya habis, dan tier gratis menjaga sesi tetap berjalan di ujung rantai.

Dashboard berjalan di `http://localhost:667/dashboard`, tempat Anda menghubungkan provider, membuat kombinasi model, dan memantau penggunaan. Key tetap berada di mesin Anda, traffic dirutekan secara lokal, dan gateway ini dikirim sebagai paket npm dan image Docker yang dibangun di atas aplikasi Next.js yang berjalan di Node.js.

- **Satu endpoint, satu key** — setiap provider yang terhubung, dapat dijangkau dari setiap tool
- **800+ model** — ditampilkan secara langsung melalui `GET /v1/models`
- **Fallback 3 tingkat** — Langganan, lalu Murah, lalu Gratis
- **Hemat token bawaan** — output tool dikompresi sebelum mencapai model
- **Local-first** — key dan traffic Anda tetap berada di mesin Anda

Rilis saat ini: v1.0.5. Membutuhkan Node.js 20.9 atau yang lebih baru.

---

## Kenapa Bansur Router

| Masalah | Apa yang dilakukan Bansur Router |
| --- | --- |
| Kuota langganan kedaluwarsa tanpa terpakai setiap bulan | Melacak kuota per akun dan memakainya sebelum direset |
| Rate limit menghentikan Anda di tengah sesi coding | Fallback otomatis: Langganan → Murah → Gratis |
| Output tool seperti `git diff`, `grep`, dan `ls` membakar token | Mengompresi hasil tool dengan RTK, menghemat 20–40% token per request |
| Setiap provider meminta $20–50 per bulan | Mengarahkan pekerjaan ke tier murah dan gratis ketika kualitasnya cukup |
| Berpindah provider secara manual, terpisah untuk setiap tool | Memberikan setiap tool satu endpoint dan satu key, dengan round-robin multi-akun di belakangnya |

---

## Mulai Cepat

### 1. Instal dan jalankan

```bash
npm install -g bansur-router
bansur-router
```

Dashboard terbuka di `http://localhost:667`.

### 2. Hubungkan sebuah provider

Buka **Dashboard → Providers → Connect**.

Anda tidak memerlukan akun berbayar untuk memulai. Hubungkan **Kiro AI** untuk tier gratis sekitar 50 kredit per bulan, yang mencakup Claude 4.5, GLM-5, dan MiniMax, atau hubungkan **OpenCode Free**, yang sama sekali tidak memerlukan autentikasi. Jika Anda sudah memiliki langganan atau API key, hubungkan itu saja — atau sekalian keduanya.

### 3. Arahkan tool Anda ke Bansur Router

```text
Endpoint: http://localhost:667/v1
API Key:  copy it from the dashboard
Model:    kr/claude-sonnet-4.5
```

Hanya itu setup-nya. Tool Anda sekarang menjangkau setiap provider yang terhubung melalui satu endpoint tersebut, dan Bansur Router memutuskan ke mana setiap request pergi.

Cara lain menjalankan Bansur Router — Docker dan build dari source — dibahas di [Panduan Setup](#panduan-setup).

---

## Cara Kerja

Setiap request tiba dalam format yang dikirim tool Anda, melewati gateway, dan keluar dalam format yang diharapkan provider yang dipilih.

```text
Your CLI tool
  Claude Code, Codex, Cursor, Cline, ...
        |
        |  http://localhost:667/v1
        v
Bansur Router
  - RTK token saver (compress tool results)
  - Format translation (OpenAI <-> Claude <-> Gemini)
  - Quota tracking per account
  - Automatic OAuth token refresh
        |
        +--> Tier 1: SUBSCRIPTION
        |    Claude Code, Codex, GitHub Copilot
        |    (used first, while quota lasts)
        |
        +--> Tier 2: CHEAP
        |    GLM ($0.6 / 1M tokens), MiniMax ($0.20 / 1M tokens)
        |    (takes over when subscription quota runs out)
        |
        +--> Tier 3: FREE
             Kiro, OpenCode Free, Vertex AI ($300 credits
             for new Google Cloud accounts)
             (keeps the session running at no cost)
```

Fallback berjalan otomatis. Ketika tier yang aktif mengembalikan error kuota atau rate limit, request bergerak turun mengikuti rantai alih-alih gagal di editor Anda.

---

## Fitur Utama

| Fitur | Fungsinya |
| --- | --- |
| RTK Token Saver | Mengompresi output tool — `git diff`, `grep`, `ls`, dan hasil serupa — sebelum dikirim ke model, menghemat 20–40% token per request |
| Headroom Token Saver | Menerapkan kompresi tambahan pada konteks request, sehingga semakin mengurangi token yang dikonsumsi sesi yang panjang |
| Smart 3-Tier Fallback | Mengarahkan setiap request Langganan → Murah → Gratis, berpindah tier secara otomatis saat kuota habis atau terkena rate limit |
| Real-Time Quota Tracking | Menampilkan penggunaan dan waktu reset secara langsung per akun, sehingga kuota langganan terpakai sebelum kedaluwarsa, bukan sesudahnya |
| Format Translation | Menerjemahkan antar format request OpenAI, Claude, dan Gemini, sehingga tool yang dibangun untuk satu API dapat memakai provider yang dibangun untuk API lain |
| Multi-Account Support | Menyimpan beberapa akun per provider dan mendistribusikan request ke akun-akun tersebut dengan routing round-robin |
| Auto Token Refresh | Me-refresh token OAuth secara otomatis, sehingga provider yang terhubung tetap terhubung tanpa login berulang |
| Custom Combos | Mengelompokkan model dari provider dan tier yang berbeda ke dalam kombinasi bernama yang Anda pilih sebagai satu model di tool Anda |
| Request Logging | Mencatat request dan respons untuk diperiksa, sehingga masalah routing dan provider terlihat, bukan diam-diam |
| Cloud Sync | Menyinkronkan konfigurasi Anda antar mesin, sehingga komputer kedua mulai dari provider dan combo yang sama |
| Usage Analytics | Merinci penggunaan token dari waktu ke waktu berdasarkan provider, akun, dan model |
| Deploy Anywhere | Berjalan secara lokal, di Docker, atau di VPS, dengan dashboard dan endpoint yang sama di setiap kasus |

---

## Tool CLI yang Didukung

Tool apa pun yang menerima endpoint kustom yang kompatibel dengan OpenAI dapat menggunakan Bansur Router. Tool-tool di bawah ini didukung secara langsung, dan sebagian besar dapat dikonfigurasi dari bagian CLI Tools di dashboard alih-alih mengedit file konfigurasi secara manual.

- Claude Code
- OpenAI Codex
- Cursor
- Cline
- OpenCode
- Antigravity
- GitHub Copilot
- OpenClaw
- Continue
- RooCode

Untuk setiap tool, konfigurasinya adalah tiga nilai yang sama: endpoint `http://localhost:667/v1`, API key yang disalin dari dashboard, dan model atau combo yang ingin Anda pakai untuk tool tersebut.

---

## Provider yang Didukung

Provider yang terhubung mengekspos lebih dari 800 model melalui satu endpoint. Panggil `GET /v1/models` pada instance yang sedang berjalan untuk daftar pasti yang tersedia bagi koneksi Anda.

### Provider OAuth

Hubungkan dengan login dari dashboard. Bansur Router menyimpan sesi tersebut, me-refresh tokennya secara otomatis, dan melacak kuotanya.

- Claude Code
- Codex
- GitHub Copilot
- Antigravity
- Gemini
- iFlow
- Windsurf
- Kiro

### Provider Gratis

Tier-tier ini tidak memerlukan pembayaran, sehingga menjadi cara tercepat untuk request pertama yang berhasil.

| Provider | Apa yang diberikan tier gratis |
| --- | --- |
| Kiro AI | Sekitar 50 kredit gratis per bulan, termasuk Claude 4.5, GLM-5, dan MiniMax |
| OpenCode Free | Akses tanpa autentikasi |
| Vertex AI | Kredit $300 untuk akun Google Cloud baru |

### Provider API Key

Lebih dari 40 provider terhubung dengan API key, termasuk layanan bergaya OpenAI dan Anthropic serta beragam host model. Opsi berbiaya rendah yang paling sering digunakan sebagai tier kedua adalah:

| Provider | Harga |
| --- | --- |
| GLM | $0.6 per 1M tokens |
| MiniMax | $0.20 per 1M tokens |
| Kimi | $9 per month flat |

### Provider Self-hosted

Endpoint apa pun yang berbicara dalam format yang kompatibel dengan OpenAI dapat dihubungkan sebagai provider, sehingga model yang Anda layani sendiri berada dalam rantai routing yang sama — dan combo yang sama — dengan provider yang di-hosting.

---

## Referensi API

Bansur Router mengekspos API yang kompatibel dengan OpenAI pada endpoint lokalnya. Lakukan autentikasi dengan API key yang ditampilkan di dashboard.

### Daftar model

```text
GET /v1/models
```

Mengembalikan setiap model yang tersedia di seluruh provider Anda yang terhubung — lebih dari 800 model setelah provider-provider umum terhubung.

### Membuat chat completion

```text
POST /v1/chat/completions
Authorization: Bearer <dashboard API key>
```

```bash
curl http://localhost:667/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kr/claude-sonnet-4.5",
    "messages": [
      { "role": "user", "content": "Explain what this function does." }
    ]
  }'
```

Bentuk request dan respons mengikuti format chat completions OpenAI. Bansur Router menerjemahkannya ke format asli provider mana pun yang dipilih oleh rantai routing.

URL penting pada instalasi default:

- Dashboard: `http://localhost:667/dashboard`
- API base: `http://localhost:667/v1`

---

## Panduan Setup

### Menjalankan dengan Docker

Dari sebuah checkout repositori ini:

```bash
docker compose up -d
```

Image yang diterbitkan tersedia sebagai `bansur/router` di Docker Hub dan sebagai `ghcr.io/mas-ajam/bansur-router` di GitHub Container Registry. Dashboard dan API dilayani pada port 667, sama seperti instalasi lokal.

### Menjalankan dari source

```bash
cp .env.example .env
npm install
npm run build
PORT=667 HOSTNAME=0.0.0.0 NEXT_PUBLIC_BASE_URL=http://localhost:667 npm run start
```

### Menghubungkan provider

1. Jalankan Bansur Router dan buka `http://localhost:667/dashboard`.
2. Buka **Providers** dan pilih **Connect** pada provider yang Anda inginkan.
3. Untuk provider OAuth, selesaikan login di jendela yang terbuka. Untuk provider API key, tempelkan key yang diterbitkan oleh provider tersebut.
4. Kirim sebuah request. Kuota dan penggunaan provider akan muncul di dashboard seiring request dirutekan.

Mulailah dengan provider gratis jika Anda hanya ingin memverifikasi setup: Kiro AI atau OpenCode Free sama-sama berfungsi tanpa paket berbayar.

### Membuat combo

Combo adalah daftar model terurut yang diperlakukan sebagai satu model yang dapat dipilih. Letakkan model langganan Anda pertama, model murah kedua, dan model gratis terakhir, lalu pilih combo tersebut di tool Anda. Ketika model pertama tidak tersedia — kuota habis, terkena rate limit, atau error — request berpindah ke entri berikutnya secara otomatis.

### Mengubah port

Port 667 adalah default, bukan keharusan.

```bash
bansur-router --port 8080
```

Bentuk singkat `-p` juga dapat digunakan, dan variabel lingkungan `PORT` mengatur port untuk deployment source, Docker, dan server. Jika Anda mengubah port, perbarui endpoint di tool Anda agar sesuai, misalnya `http://localhost:8080/v1`. Memisahkan port juga merupakan cara paling sederhana untuk menjalankan Bansur Router bersamaan dengan layanan lokal lain yang sudah menempati 667.

---

## Pertanyaan yang Sering Diajukan

### Apa itu Bansur Router?

Sebuah gateway AI lokal untuk tool coding. Ia menempatkan satu endpoint yang kompatibel dengan OpenAI di depan semua provider AI Anda dan mengarahkan setiap request ke provider terbaik yang tersedia, sehingga tool Anda mempertahankan satu konfigurasi sementara provider, akun, dan kuota berubah di belakangnya.

### Apakah gratis?

Ya. Bansur Router sendiri gratis dan open source di bawah lisensi MIT. Biaya sebuah request bergantung pada provider tujuannya: tier gratis seperti Kiro AI dan OpenCode Free tidak berbiaya apa pun, dan untuk sisanya Anda membawa langganan dan API key Anda sendiri dan membayar langsung ke provider tersebut, persis seperti yang Anda lakukan tanpa gateway.

### Di mana data saya berada?

Di mesin Anda. Bansur Router bersifat local-first: key provider disimpan secara lokal, request dirutekan dari instalasi Anda sendiri, dan tugas gateway adalah meneruskannya ke provider yang Anda pilih. Tidak ada akun terpisah yang perlu dibuat sebelum request pertama.

### Port apa yang digunakannya?

667 secara default, untuk dashboard maupun API. Ubah dengan `--port` (atau `-p`) saat menjalankan CLI, atau dengan variabel lingkungan `PORT`.

### Tool apa saja yang didukung?

Claude Code, OpenAI Codex, Cursor, Cline, OpenCode, Antigravity, GitHub Copilot, OpenClaw, Continue, dan RooCode didukung secara langsung. Tool lain apa pun yang memungkinkan Anda mengatur endpoint kustom yang kompatibel dengan OpenAI dan API key dapat menggunakannya dengan tiga nilai yang sama.

### Catatan untuk pengguna Windows

Hentikan instance Bansur Router yang sedang berjalan sebelum memperbarui paket npm global. Windows mengunci file-file instalasi yang sedang berjalan, sehingga pembaruan yang dicoba saat gateway masih berjalan akan gagal sampai prosesnya dihentikan.

---

## Pemecahan Masalah

### Port sudah digunakan

Sesuatu di mesin Anda sudah mendengarkan di 667, sering kali proses Bansur Router sebelumnya yang masih berjalan. Hentikan proses tersebut, atau jalankan di port lain dan arahkan tool Anda ke sana:

```bash
bansur-router --port 8080
```

### Provider gagal terhubung

Hubungkan kembali dari dashboard: **Providers → Connect** untuk provider tersebut, dan selesaikan login atau entri key sekali lagi. Koneksi baru menggantikan sesi yang tersimpan, dan auto refresh token menjaganya tetap valid setelah itu.

### Pembaruan gagal di Windows

Hentikan instance yang sedang berjalan terlebih dahulu, lalu jalankan pembaruan lagi. Instalasi yang sedang berjalan mengunci file programnya sendiri di Windows, yang menghalangi paket npm global untuk diganti.

### Request gagal setelah mengubah port

Tool Anda masih menunjuk ke alamat lama. Perbarui endpoint-nya ke port baru — misalnya `http://localhost:8080/v1` — dan pastikan API key adalah yang ditampilkan di dashboard instance yang sekarang berjalan.

---

## Dukungan

Laporkan bug dan minta fitur melalui [GitHub Issues](https://github.com/mas-ajam/bansur-router/issues) di repositori `mas-ajam/bansur-router`. Sertakan versi yang Anda jalankan, cara Bansur Router dijalankan (npm, Docker, atau source), dan log request yang relevan jika menyangkut masalah routing.

Dokumentasi lengkap ada di [bansur-router.pages.dev](https://bansur-router.pages.dev).

---

## Lisensi

Bansur Router dirilis di bawah [Lisensi MIT](../LICENSE).
