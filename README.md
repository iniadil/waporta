# waporta

REST API and Dashboard UI for WhatsApp Gateway, built with [Hono](https://hono.dev), [wa-multi-session](https://github.com/mimamch/wa-multi-session), and React.

## Prerequisites

- Node.js v18+
- `wa-multi-session` library built locally (see Setup)

## Setup

**1. Install dependencies**

```bash
npm install
```

**2. Build wa-multi-session**

This project uses a local path for `wa-multi-session` which needs to be built first:

```bash
cd /Volumes/Adil/Workspace/dev/playground/wa-multi-session
npm install
./node_modules/.bin/tsc
```

## Running

### API only

```bash
npm run dev     # development with auto-reload
npm run start   # production (build + run)
```

Server runs at `http://localhost:3000`. Override port via env:

```bash
PORT=8080 npm start
```

### API + Dashboard (development)

```bash
npm run dev:all
```

Or in two separate terminals:

```bash
npm run dev            # backend  → http://localhost:3000
npm run dashboard:dev  # frontend → http://localhost:5173
```

### API + Dashboard (production)

```bash
npm run dashboard:build
npm run start
```

Dashboard available at `http://localhost:3000/dashboard`.

## Dashboard

A UI for managing sessions, sending messages, and checking numbers — no Swagger or curl needed.

**Stack**: React + Vite, Headless UI v2, IBM Plex Mono — dark terminal aesthetic.

| Page      | Description                                          |
| --------- | ---------------------------------------------------- |
| Overview  | Session stats + quick actions                        |
| Sessions  | Create sessions (QR / Pairing Code), delete sessions |
| Messaging | Send text, image, or document messages               |
| Checker   | Check if a number is registered on WhatsApp          |

QR codes are displayed directly in the browser — the dashboard polls `/sessions/:sessionId/qr` every 2 seconds automatically.

## API Endpoints

Base URL: `http://localhost:3000/api/whatsapp`

Interactive docs available at `http://localhost:3000/doc` (Swagger UI).

### Sessions

| Method   | Path                                | Description                       |
| -------- | ----------------------------------- | --------------------------------- |
| `GET`    | `/sessions`                         | List all sessions                 |
| `POST`   | `/sessions/:sessionId`              | Start a new session               |
| `POST`   | `/sessions/:sessionId/pairing-code` | Start a session via pairing code  |
| `GET`    | `/sessions/:sessionId`              | Get session status                |
| `GET`    | `/sessions/:sessionId/qr`           | Get session QR code (for polling) |
| `DELETE` | `/sessions/:sessionId`              | Delete and logout a session       |

### Messaging

| Method | Path             | Description          |
| ------ | ---------------- | -------------------- |
| `POST` | `/send/text`     | Send a text message  |
| `POST` | `/send/image`    | Send an image        |
| `POST` | `/send/document` | Send a document/file |

### Utilities

| Method | Path                    | Description                                 |
| ------ | ----------------------- | ------------------------------------------- |
| `GET`  | `/check?sessionId=&to=` | Check if a number is registered on WhatsApp |

## Usage Examples

**Start a new session**

```bash
curl -X POST http://localhost:3000/api/whatsapp/sessions/my-session
```

Scan the QR code via the dashboard or fetch it directly:

```bash
curl http://localhost:3000/api/whatsapp/sessions/my-session/qr
```

**Start a session via pairing code**

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

Enter the pairing code in WhatsApp → Linked Devices → Link with phone number.

**Send a text message**

```bash
curl -X POST http://localhost:3000/api/whatsapp/send/text \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session", "to": "6281234567890", "text": "Hello!"}'
```

**Send an image**

```bash
curl -X POST http://localhost:3000/api/whatsapp/send/image \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session", "to": "6281234567890", "media": "https://example.com/image.jpg", "text": "Caption"}'
```

**Send a document**

```bash
curl -X POST http://localhost:3000/api/whatsapp/send/document \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session", "to": "6281234567890", "media": "https://example.com/file.pdf", "filename": "document.pdf"}'
```

**Check a number**

```bash
curl "http://localhost:3000/api/whatsapp/check?sessionId=my-session&to=6281234567890"
```

**Delete a session**

```bash
curl -X DELETE http://localhost:3000/api/whatsapp/sessions/my-session
```

## Notes

- Phone number format: country code without `+`, e.g. `6281234567890`
- For group messages, add `"isGroup": true` to the request body
- Session credentials are stored automatically in SQLite (`baileys_store.db`)
