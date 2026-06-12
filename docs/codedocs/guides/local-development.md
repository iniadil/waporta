---
title: "Local Development"
description: "Run the backend and dashboard locally, configure credentials, and verify the development workflow."
---

This guide is for working on waporta from source without Docker. It is the right path when you need hot reload, want to inspect the Hono routes directly, or plan to modify the dashboard under `dashboard/`.

## Problem

You need a local setup that gives you:

- Backend code reload for `index.ts` and `src/*`.
- A live dashboard frontend for session management.
- A predictable `.env` configuration for credentials and optional notifications.

## Solution

Use the repository’s built-in development scripts. `npm run dev` watches the backend with `tsx`, `npm run dashboard:dev` starts the Vite frontend, and `npm run dev:all` runs both together with `concurrently`.

<Steps>
<Step>
### Install dependencies

```bash
git clone https://github.com/iniadil/waporta.git
cd waporta
npm install
cd dashboard
npm install
cd ..
```

</Step>
<Step>
### Create the environment file

```bash
cp .env.example .env
```

Set at least:

```bash
PORT=3000
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=changeme
DEFAULT_API_KEY=wap_local_demo_key
```

</Step>
<Step>
### Start the backend and dashboard

```bash
npm run dev:all
```

The backend runs on `http://localhost:3000`. The dashboard development server runs on `http://localhost:5173`, which is why `src/index.ts` enables CORS for `http://localhost:5173` on `/api/*` and `/auth/*`.

</Step>
<Step>
### Verify the runtime

```bash
curl http://localhost:3000/
curl http://localhost:3000/api/whatsapp/sessions \
  -H "X-API-Key: wap_local_demo_key"
```

</Step>
</Steps>

## Runnable Example

This script verifies the two auth paths used during development.

```ts
const baseUrl = 'http://localhost:3000';

const login = await fetch(`${baseUrl}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'changeme' }),
}).then((res) => res.json());

const sessionsWithToken = await fetch(`${baseUrl}/api/whatsapp/sessions`, {
  headers: { Authorization: `Bearer ${login.token}` },
}).then((res) => res.json());

const sessionsWithApiKey = await fetch(`${baseUrl}/api/whatsapp/sessions`, {
  headers: { 'X-API-Key': 'wap_local_demo_key' },
}).then((res) => res.json());

console.log({ sessionsWithToken, sessionsWithApiKey });
```

Expected output on a fresh install is two empty session lists.

## Notes For Contributors

The backend entrypoint is `index.ts`, but almost all composition happens in `src/index.ts`. If you change routes or OpenAPI schemas, regenerate `openapi.json` with `npm run gen:swagger`. If you change the dashboard, remember that production serves static assets from `dashboard/dist` under `/dashboard`, while development uses the separate Vite server.

If you prefer a production-like environment instead of two local processes, move to [Docker Deployment](/docs/guides/docker-deployment).
