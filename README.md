<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://storage.iniadil.dev/wa-porta/waporta-github-dark.png">
  <img src="https://storage.iniadil.dev/wa-porta/waporta-github.png" alt="waporta" width="100%" />
</picture>
<br />
<br />

[![Website](https://img.shields.io/badge/website-waporta.net-black?style=flat-square)](https://waporta.net) [![Docs](https://img.shields.io/badge/docs-waporta.net-blue?style=flat-square)](https://waporta.net/docs) ![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=flat-square) [![Baileys](https://img.shields.io/badge/Baileys-7.0.0--rc.6-blue?style=flat-square)](https://www.npmjs.com/package/baileys)

A lightweight, self-hosted WhatsApp unofficial API with a built-in dashboard. Supports **multi-device** and **multi-session** out of the box.

Built with [Hono](https://hono.dev), [Baileys](https://github.com/WhiskeySockets/Baileys), and React.

## Demo

![demo](./demo.gif)

## Quick Start

**One command to install and run:**

```bash
curl -fsSL https://storage.iniadil.dev/wa-porta/install.sh | sh
```

The script clones the repo, asks for your dashboard credentials, and starts the containers. Done.

---

**Or set it up manually in 4 steps:**

**1. Run**

```bash
git clone https://github.com/iniadil/waporta.git
cd waporta
cp .env.example .env          # set DASHBOARD_USERNAME and DASHBOARD_PASSWORD
docker compose up -d
```

**2. Get an API key**

Option A — set a static key in `.env` before starting:

```env
DEFAULT_API_KEY=wap_your_static_key_here
```

Option B — generate one from the dashboard: open `http://localhost:3000/dashboard` → log in → **API Keys** → enter a name → **Generate** → copy the key (shown once).

**3. Connect WhatsApp**

Open **Sessions** in the dashboard → create a session → scan the QR code or use a pairing code.

**4. Send a message**

```bash
curl -X POST http://localhost:3000/api/whatsapp/send/text \
  -H "X-API-Key: wap_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session", "to": "6281234567890", "text": "Hello!"}'
```

---

## Why waporta?

- **Multi-device** — uses the latest WhatsApp multi-device protocol via Baileys; no phone needs to stay online
- **Multi-session** — manage multiple WhatsApp numbers from one server
- **Lightweight** — minimal dependencies, fast startup, low memory footprint
- **Dashboard included** — manage sessions, send messages, and check numbers from the browser
- **REST API** — integrate with any backend or automation tool

---

## Setup

### Docker (Recommended)

```bash
git clone https://github.com/iniadil/waporta.git
cd waporta
cp .env.example .env
```

Edit `.env`:

```env
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=your-secure-password
# Optional: skip dashboard key generation by setting a static API key
DEFAULT_API_KEY=wap_your_static_key_here
```

```bash
docker compose up -d
```

Dashboard and API available at `http://localhost:3000`.

**Common commands**

```bash
PORT=8080 docker compose up -d   # custom port
docker compose logs -f            # view logs
docker compose down               # stop
git pull && docker compose up -d --build  # upgrade
```

**Persistent data** (all under `./data/` on the host)

| Path               | Contents                  |
| ------------------ | ------------------------- |
| `baileys_store.db` | SQLite session store      |
| `wa_credentials/`  | WhatsApp credential files |
| `api_keys.json`    | API keys                  |

> Back up `./data/` to preserve sessions and API keys across migrations.

<details>
<summary>Without Docker Compose</summary>

```bash
docker build -t waporta .
docker run -d \
  --name waporta \
  -p 3000:3000 \
  -v $(pwd)/data/baileys_store.db:/app/baileys_store.db \
  -v $(pwd)/data/wa_credentials:/app/wa_credentials \
  -v $(pwd)/data:/app/data \
  -e NODE_ENV=production \
  -e DASHBOARD_USERNAME=admin \
  -e DASHBOARD_PASSWORD=your-secure-password \
  --restart unless-stopped \
  waporta
```

</details>

### Without Docker

```bash
git clone https://github.com/iniadil/waporta.git
cd waporta
npm install
cp .env.example .env
# edit .env with your credentials
```

```bash
npm run dev:all    # dev: backend + dashboard (hot reload)
npm run start      # production
```

- Backend: `http://localhost:3000`
- Dashboard (dev): `http://localhost:5173`
- Dashboard (prod): `http://localhost:3000/dashboard`

---

## Authentication

waporta uses a dual-auth system:

| Caller              | Header                          | How to get                                                             |
| ------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| Dashboard           | `Authorization: Bearer <token>` | Issued on login, stored in browser                                     |
| REST API / external | `X-API-Key: <key>`              | Set `DEFAULT_API_KEY` in `.env`, or generate from dashboard → API Keys |

All `/api/whatsapp/*` endpoints accept either. Requests without a valid credential receive `401 Unauthorized`.

---

## Dashboard

| Page      | Description                                            |
| --------- | ------------------------------------------------------ |
| Overview  | Session stats + quick actions                          |
| Sessions  | Create sessions (QR / Pairing Code), delete sessions   |
| Messaging | Send text, image, or document messages                 |
| Checker   | Check if a number is registered on WhatsApp            |
| API Keys  | Generate and revoke API keys for external integrations |

QR codes are polled automatically every 2 seconds.

---

## API Reference

Base URL: `http://localhost:3000/api/whatsapp`
Interactive docs: [`https://waporta.net`](https://waporta.net) or `http://localhost:3000/doc`

### Sessions

| Method   | Path                                | Description               |
| -------- | ----------------------------------- | ------------------------- |
| `GET`    | `/sessions`                         | List all sessions         |
| `POST`   | `/sessions/:sessionId`              | Start a new session       |
| `POST`   | `/sessions/:sessionId/pairing-code` | Start via pairing code    |
| `GET`    | `/sessions/:sessionId`              | Get session status        |
| `GET`    | `/sessions/:sessionId/qr`           | Get QR code               |
| `DELETE` | `/sessions/:sessionId`              | Delete and logout session |

### Messaging

| Method | Path             | Description          |
| ------ | ---------------- | -------------------- |
| `POST` | `/send/text`     | Send a text message  |
| `POST` | `/send/image`    | Send an image        |
| `POST` | `/send/document` | Send a document/file |

### Utilities

| Method | Path                    | Description                      |
| ------ | ----------------------- | -------------------------------- |
| `GET`  | `/check?sessionId=&to=` | Check if a number is on WhatsApp |

### Examples

```bash
# Start a session
curl -X POST http://localhost:3000/api/whatsapp/sessions/my-session \
  -H "X-API-Key: wap_your_key_here"

# Send text
curl -X POST http://localhost:3000/api/whatsapp/send/text \
  -H "X-API-Key: wap_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session", "to": "6281234567890", "text": "Hello!"}'

# Send image
curl -X POST http://localhost:3000/api/whatsapp/send/image \
  -H "X-API-Key: wap_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session", "to": "6281234567890", "media": "https://example.com/image.jpg", "text": "Caption"}'

# Send document
curl -X POST http://localhost:3000/api/whatsapp/send/document \
  -H "X-API-Key: wap_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "my-session", "to": "6281234567890", "media": "https://example.com/file.pdf", "filename": "document.pdf"}'

# Check number
curl "http://localhost:3000/api/whatsapp/check?sessionId=my-session&to=6281234567890" \
  -H "X-API-Key: wap_your_key_here"

# Pairing code
curl -X POST http://localhost:3000/api/whatsapp/sessions/my-session/pairing-code \
  -H "X-API-Key: wap_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "628123456789"}'

# Delete session
curl -X DELETE http://localhost:3000/api/whatsapp/sessions/my-session \
  -H "X-API-Key: wap_your_key_here"
```

---

## Notes

- Phone numbers: country code without `+`, e.g. `6281234567890`
- Group messages: add `"isGroup": true` to the request body
- Session data is stored in SQLite (`baileys_store.db`)
- API keys are stored in `data/api_keys.json`
- `DEFAULT_API_KEY` in `.env` works without creating a key from the dashboard

---

## Feedback & Support

- Website & docs: [waporta.net](https://waporta.net)
- Found a bug or have a feature request? [Open an issue](https://github.com/iniadil/waporta/issues) on GitHub.
- For direct inquiries, reach out at [me@iniadil.dev](mailto:me@iniadil.dev).
