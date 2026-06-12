---
title: "Docker Deployment"
description: "Deploy waporta with Docker Compose, persist session data, and prepare for upgrades."
---

This is the recommended path for running waporta in production or on a self-hosted VM. The repository already ships a multi-stage `Dockerfile` and a `docker-compose.yml` that mount persistent data and expose the server on port `3000`.

## Problem

You want one deployment unit that:

- Builds both the backend and the dashboard.
- Persists WhatsApp credentials, webhook URLs, and API keys.
- Can be upgraded without manually rebuilding frontend and backend assets.

## Solution

Use the repository’s compose file with a real `.env`. The container image compiles the backend, builds the React dashboard, installs production dependencies, and runs `node dist/index.js`.

<Steps>
<Step>
### Prepare the project directory

```bash
git clone https://github.com/iniadil/waporta.git
cd waporta
cp .env.example .env
```

</Step>
<Step>
### Configure production credentials

Edit `.env`:

```bash
PORT=3000
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=replace_me
DEFAULT_API_KEY=wap_prod_bootstrap_key
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=mailer
SMTP_PASS=secret
SMTP_FROM=waporta@example.com
NOTIFY_EMAIL=ops@example.com
NOTIFY_WEBHOOK_URL=https://ops.example.com/waporta/failures
```

</Step>
<Step>
### Start the stack

```bash
docker compose up -d
docker compose logs -f
```

The health check defined in `docker-compose.yml` uses `wget http://localhost:3000/` inside the container.

</Step>
<Step>
### Verify persistence

After the container starts, confirm the local `data/` directory exists and contains the expected files as the app runs:

```bash
ls -la data
```

You should eventually see `api_keys.json`, `webhook_urls.json`, `wa_credentials/`, and `baileys_store.db`.

</Step>
</Steps>

## Runnable Example

The deployment is ready when these commands succeed from the host:

```bash
curl http://localhost:3000/
curl http://localhost:3000/doc
curl http://localhost:3000/api/whatsapp/sessions \
  -H "X-API-Key: wap_prod_bootstrap_key"
```

The first call verifies the health endpoint from `src/index.ts`, the second confirms the Swagger UI route is mounted, and the third confirms `dualAuthMiddleware` is accepting the bootstrap API key.

## How Persistence Works

`docker-compose.yml` mounts three paths:

- `./data/baileys_store.db:/app/baileys_store.db`
- `./data/wa_credentials:/app/wa_credentials`
- `./data:/app/data`

The `wa-multi-session` runtime uses the SQLite store and credential directory for WhatsApp session state. waporta itself writes API keys and webhook URLs under `/app/data`, which means the local `data/` directory is the backup boundary for nearly everything that is specific to your installation.

## Upgrade Pattern

The README recommends:

```bash
git pull
docker compose up -d --build
```

That is a sensible default because the container rebuild pulls in updated backend code, refreshed `dashboard/dist`, and the current `openapi.json`. The important part is not to delete the mounted `data/` directory unless you explicitly want to discard sessions and generated API keys.

For a development-oriented workflow, go back to [Local Development](/docs/guides/local-development). For the first operator workflow after deploy, continue to [Connect, Send, and Check](/docs/guides/connect-send-and-check).
