# wa-gateway

REST API untuk WhatsApp Gateway berbasis [Hono](https://hono.dev) dan [wa-multi-session](https://github.com/deniandreawan/wa-multi-session), dijalankan dengan Node.js.

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

## Menjalankan Server

```bash
npm start
```

Untuk development dengan auto-reload:

```bash
npm run dev
```

Server berjalan di `http://localhost:3000`. Port bisa diubah via environment variable:

```bash
PORT=8080 npm start
```

## API Endpoints

Base URL: `http://localhost:3000/api/whatsapp`

### Session

| Method | Path | Deskripsi |
|--------|------|-----------|
| `GET` | `/sessions` | List semua session aktif |
| `POST` | `/sessions/:sessionId` | Mulai session baru (scan QR di terminal) |
| `POST` | `/sessions/:sessionId/pairing-code` | Mulai session baru via pairing code |
| `GET` | `/sessions/:sessionId` | Status session |
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
| `GET` | `/check?sessionId=&to=` | Cek apakah nomor terdaftar di WA |

## Contoh Penggunaan

**Mulai session baru**

```bash
curl -X POST http://localhost:3000/api/whatsapp/sessions/my-session
```

Scan QR code yang muncul di terminal.

**Mulai session via pairing code**

```bash
curl -X POST http://localhost:3000/api/whatsapp/sessions/my-session/pairing-code \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "628123456789"}'
```

Response berisi pairing code yang harus dimasukkan di WhatsApp → Perangkat Tertaut → Tautkan dengan nomor telepon:

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
  -d '{"sessionId": "my-session", "to": "6281234567890", "media": "https://example.com/image.jpg", "text": "Caption gambar"}'
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

- Format nomor telepon: gunakan kode negara tanpa `+`, contoh `6281234567890`
- Untuk group, tambahkan `"isGroup": true` pada body request
- Credentials session disimpan otomatis di SQLite (`baileys_store.db`)
