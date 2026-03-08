# wa-gateway

REST API dan Dashboard UI untuk WhatsApp Gateway, berbasis [Hono](https://hono.dev), [wa-multi-session](https://github.com/deniandreawan/wa-multi-session), dan React.

## Prasyarat

- Node.js v18+
- Library `wa-multi-session` sudah ter-build (lihat bagian Setup)

## Setup

**1. Install dependencies**

```bash
npm install
```

**2. Build library wa-multi-session**

Library `wa-multi-session` menggunakan path lokal dan perlu di-build terlebih dahulu:

```bash
cd /Volumes/Adil/Workspace/dev/playground/wa-multi-session
npm install
./node_modules/.bin/tsc
```

## Menjalankan

### API saja

```bash
npm run dev       # development dengan auto-reload
npm run start     # production (build + run)
```

Server berjalan di `http://localhost:3000`. Port bisa diubah via env:

```bash
PORT=8080 npm start
```

### API + Dashboard (development)

```bash
npm run dev:all
```

Atau jalankan di dua terminal terpisah:

```bash
npm run dev            # backend  → http://localhost:3000
npm run dashboard:dev  # frontend → http://localhost:5173
```

### API + Dashboard (production)

```bash
npm run dashboard:build
npm run start
```

Dashboard tersedia di `http://localhost:3000/dashboard`.

## Dashboard

Dashboard UI untuk mengelola session, mengirim pesan, dan cek nomor — tanpa perlu Swagger atau curl.

**Stack**: React + Vite, Headless UI v2, IBM Plex Mono — dark terminal aesthetic.

| Halaman | Fungsi |
|---------|--------|
| Overview | Statistik session + quick actions |
| Sessions | Buat session (QR / Pairing Code), hapus session |
| Messaging | Kirim teks, gambar, atau dokumen |
| Checker | Cek apakah nomor terdaftar di WhatsApp |

QR code tampil langsung di browser — dashboard polling `/sessions/:sessionId/qr` setiap 2 detik secara otomatis.

## API Endpoints

Base URL: `http://localhost:3000/api/whatsapp`

Dokumentasi interaktif tersedia di `http://localhost:3000/doc` (Swagger UI).

### Session

| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/sessions` | List semua session |
| `POST` | `/sessions/:sessionId` | Mulai session baru |
| `POST` | `/sessions/:sessionId/pairing-code` | Mulai session via pairing code |
| `GET` | `/sessions/:sessionId` | Status session |
| `GET` | `/sessions/:sessionId/qr` | QR code session (polling) |
| `DELETE` | `/sessions/:sessionId` | Hapus & logout session |

### Pesan

| Method | Path | Deskripsi |
|--------|------|-----------|
| `POST` | `/send/text` | Kirim pesan teks |
| `POST` | `/send/image` | Kirim gambar |
| `POST` | `/send/document` | Kirim dokumen/file |

### Utilitas

| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/check?sessionId=&to=` | Cek nomor terdaftar di WA |

## Contoh Penggunaan (curl)

**Mulai session baru**

```bash
curl -X POST http://localhost:3000/api/whatsapp/sessions/my-session
```

Scan QR via dashboard atau ambil langsung dari endpoint:

```bash
curl http://localhost:3000/api/whatsapp/sessions/my-session/qr
```

**Mulai session via pairing code**

```bash
curl -X POST http://localhost:3000/api/whatsapp/sessions/my-session/pairing-code \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "628123456789"}'
```

```json
{
  "status": "waiting_for_confirmation",
  "sessionId": "my-session",
  "pairingCode": "ABCD1234"
}
```

**Kirim pesan teks**

```bash
curl -X POST http://localhost:3000/api/whatsapp/send/text \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session", "to": "6281234567890", "text": "Halo!"}'
```

**Kirim gambar**

```bash
curl -X POST http://localhost:3000/api/whatsapp/send/image \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session", "to": "6281234567890", "media": "https://example.com/image.jpg", "text": "Caption"}'
```

**Kirim dokumen**

```bash
curl -X POST http://localhost:3000/api/whatsapp/send/document \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session", "to": "6281234567890", "media": "https://example.com/file.pdf", "filename": "dokumen.pdf"}'
```

**Cek nomor**

```bash
curl "http://localhost:3000/api/whatsapp/check?sessionId=my-session&to=6281234567890"
```

**Hapus session**

```bash
curl -X DELETE http://localhost:3000/api/whatsapp/sessions/my-session
```

## Catatan

- Format nomor telepon: kode negara tanpa `+`, contoh `6281234567890`
- Untuk pesan ke group, tambahkan `"isGroup": true` pada body request
- Credentials session disimpan otomatis di SQLite (`baileys_store.db`)
