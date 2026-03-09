# waporta

A lightweight, self-hosted WhatsApp unofficial API with a built-in dashboard. Supports **multi-device** and **multi-session** out of the box — run multiple WhatsApp accounts simultaneously from a single instance.

Built with [Hono](https://hono.dev), [Baileys](https://github.com/WhiskeySockets/Baileys), and React.

## Why waporta?

- **Multi-device** — uses the latest WhatsApp multi-device protocol via Baileys; no phone needs to stay online
- **Multi-session** — manage multiple WhatsApp numbers from one server
- **Lightweight** — minimal dependencies, fast startup, low memory footprint
- **Dashboard included** — manage sessions, send messages, and check numbers from the browser; no curl or Swagger required
- **REST API** — integrate with any backend or automation tool

## Prerequisites

- Node.js v18+

## Setup

**1. Clone the repository**

```bash
git clone https://github.com/iniadil/waporta.git
cd waporta
```

**2. Install dependencies**

```bash
npm install
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
