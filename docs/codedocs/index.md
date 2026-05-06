---
title: "Getting Started"
description: "Set up waporta, understand the problem it solves, and run the first WhatsApp session."
---

waporta is a self-hosted WhatsApp gateway that exposes multi-session messaging, session management, and inbound webhooks through a Hono-based REST API with a built-in dashboard.

## The Problem

- Running multiple WhatsApp numbers from one backend usually means stitching together session storage, QR login flows, and message delivery logic yourself.
- Most unofficial WhatsApp integrations stop at sending messages and leave inbound event delivery, webhook fan-out, and failure handling to application code.
- Teams often need both a browser dashboard for operators and an API surface for backend automation, but those paths drift unless they share the same auth and runtime.
- Production setups need persistence for credentials and keys, plus an upgrade path that does not destroy active sessions.

## The Solution

waporta centralizes those concerns in one server. `src/index.ts` mounts a single Hono application, `src/wa.ts` wraps `wa-multi-session` for WhatsApp connectivity, `src/routes/whatsapp.ts` exposes typed REST endpoints, and the webhook subsystem in `src/webhooks/*` fans inbound messages out to HTTPS endpoints per session.

```ts
const baseUrl = 'http://localhost:3000';
const apiKey = 'wap_your_key_here';

await fetch(`${baseUrl}/api/whatsapp/sessions/my-session`, {
  method: 'POST',
  headers: { 'X-API-Key': apiKey },
});

const qr = await fetch(`${baseUrl}/api/whatsapp/sessions/my-session/qr`, {
  headers: { 'X-API-Key': apiKey },
}).then((res) => res.json());

console.log(qr);
```

That flow works because the server keeps the active session in `wa-multi-session`, caches the latest QR string in `src/events.ts`, and protects the route with `dualAuthMiddleware` from `src/middleware/auth.ts`.

## Installation

waporta is deployed from source rather than installed from an npm registry package, so the package-manager tabs are for installing dependencies inside the cloned repository.

" "bun"]}>
<Tab value="npm">

```bash
git clone https://github.com/iniadil/waporta.git
cd waporta
cp .env.example .env
npm install
npm run dev:all
```

</Tab>
<Tab value="pnpm">

```bash
git clone https://github.com/iniadil/waporta.git
cd waporta
cp .env.example .env
pnpm install
pnpm run dev:all
```

</Tab>
<Tab value="yarn">

```bash
git clone https://github.com/iniadil/waporta.git
cd waporta
cp .env.example .env
yarn install
yarn dev:all
```

</Tab>
<Tab value="bun">

```bash
git clone https://github.com/iniadil/waporta.git
cd waporta
cp .env.example .env
bun install
bun run dev:all
```

</Tab>
</Tabs>

For production, the repository also ships a `docker-compose.yml` and multi-stage `Dockerfile` that bundle the dashboard and backend together on port `3000`.

## Quick Start

The minimum working setup is:

1. Copy `.env.example` to `.env`.
2. Set `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD`.
3. Start the server with `npm run dev` or `docker compose up -d`.
4. Verify the API health response.

```bash
curl http://localhost:3000/
```

Expected output:

```json
{
  "status": "ok",
  "message": "WA Porta API"
}
```

To confirm the authenticated API path is live, create a static key in `.env`:

```bash
DEFAULT_API_KEY=wap_local_demo_key
```

Then list sessions:

```bash
curl http://localhost:3000/api/whatsapp/sessions \
  -H "X-API-Key: wap_local_demo_key"
```

Expected output before any session is created:

```json
{
  "sessions": []
}
```

Once the server is healthy, move to [Architecture](/docs/architecture) to understand how requests reach WhatsApp, or jump to [Connect, Send, and Check](/docs/guides/connect-send-and-check) for the first full workflow.

## Key Features

- Multi-device, multi-session WhatsApp connectivity through `wa-multi-session`.
- Session-specific inbound message webhooks with HTTPS URL validation and duplicate detection.
- Dual authentication: in-memory bearer tokens for the dashboard and persistent API keys for external clients.
- Automatic retry for transient send failures, with optional email or webhook notifications.
- Built-in OpenAPI generation at `/openapi.json` and Swagger UI at `/doc`.
- Included React dashboard served from `/dashboard`.

<Cards>
  <Card title="Architecture" href="/docs/architecture">Trace the request flow from HTTP routes to WhatsApp and webhook delivery.</Card>
  <Card title="Core Concepts" href="/docs/session-lifecycle">Understand sessions, authentication, retries, and inbound webhooks.</Card>
  <Card title="API Reference" href="/docs/api-reference/server-app">See endpoint shapes, exported modules, and source-backed signatures.</Card>
</Cards>
