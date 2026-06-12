# Contributing to waporta

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Ways to Contribute

- Report bugs via [GitHub Issues](https://github.com/iniadil/waporta/issues)
- Suggest features or improvements
- Submit pull requests for bug fixes or new features
- Improve documentation

## Development Setup

**Prerequisites:** Node.js 20+, npm (the project is **npm-only** — see [Dependency Patches](#dependency-patches))

```bash
git clone https://github.com/iniadil/waporta.git
cd waporta
npm install
cp .env.example .env
# Edit .env: set DASHBOARD_USERNAME and DASHBOARD_PASSWORD
```

**Run in development mode (backend + dashboard with hot reload):**

```bash
npm run dev:all
```

- Backend API: `http://localhost:3000`
- Dashboard (dev): `http://localhost:5173`

**Build for production:**

```bash
npm run dashboard:build  # build dashboard static files
npm run start            # build backend + serve everything at :3000
```

## Project Structure

```
waporta/
├── src/
│   ├── index.ts          # App entry point, route registration
│   ├── apikeys.ts        # API key CRUD (persisted to data/api_keys.json)
│   ├── middleware/
│   │   └── auth.ts       # Session token + API key auth middleware
│   ├── routes/
│       ├── auth.ts       # POST /auth/login, /logout, GET /auth/check
│       ├── apikeys.ts    # GET/POST/DELETE /api/keys
│       ├── webhooks.ts   # Session webhook URL management routes
│       └── whatsapp.ts   # WhatsApp session + messaging routes
│   └── webhooks/
│       ├── dispatcher.ts # Incoming message webhook fan-out
│       ├── manager.ts    # Webhook URL create/list/delete logic
│       ├── store.ts      # data/webhook_urls.json persistence
│       └── types.ts      # Webhook records and payload types
│   ├── lib/
│   │   ├── session-guard.ts   # Anti-ban warm-up + rate-limit state
│   │   ├── send-guard.ts      # Pre-send checks (warm-up, rate-limit, isExist) + typing
│   │   ├── retry.ts           # Retry policy (transient errors only, backoff + jitter)
│   │   └── send-with-retry.ts # Send wrapper: typing + retry + failure notify
│   └── wa.ts             # Baileys / wa-multi-session client + event wiring
├── dashboard/
│   └── src/
│       ├── App.tsx        # Root: auth gate → LoginPage or Shell
│       ├── api/           # Typed fetch wrappers
│       ├── components/    # Layout (Shell, Sidebar, Header)
│       ├── hooks/         # useAuth (token lifecycle)
│       └── pages/         # Sessions, Messaging, Checker, ApiKeys, Login
├── scripts/
│   └── gen-swagger.ts    # OpenAPI spec generator
├── patches/              # patch-package patches (applied automatically on postinstall)
│   ├── wa-multi-session+4.2.3.patch
│   └── whatsapp-rust-bridge+0.5.4.patch
├── index.ts              # Hono server bootstrap
└── docker-compose.yml
```

## Dependency Patches

waporta uses [patch-package](https://github.com/ds300/patch-package) to apply fixes to dependencies that are not yet released upstream. Patches live in `patches/` and are applied automatically on `npm install` via the `postinstall` script. **This makes the project npm-only** — `pnpm`/`yarn` do not run the same `postinstall` + `overrides` flow.

| Package | Patch | Why |
| --- | --- | --- |
| `wa-multi-session@4.2.3` | `wa-multi-session+4.2.3.patch` | Stop reconnecting on ban/logout codes (401/403/500), add backoff + jitter, and stagger session startup |
| `whatsapp-rust-bridge@0.5.4` | `whatsapp-rust-bridge+0.5.4.patch` | Add a `require` condition to the package `exports` so the CJS resolver (tsx) can load it |

The Baileys version is also pinned through npm `overrides` in `package.json`:

```json
"overrides": { "wa-multi-session": { "baileys": "7.0.0-rc13" } }
```

### Regenerating a patch

1. Edit the file under `node_modules/<package>/` directly.
2. Regenerate the patch:
   ```bash
   npx patch-package <package-name>
   ```
3. **Gotcha:** patch-package excludes `package.json` by default. To capture a `package.json` change (as in the `whatsapp-rust-bridge` patch), override the exclude list:
   ```bash
   npx patch-package whatsapp-rust-bridge --include 'package\.json$' --exclude 'a^'
   ```
4. Commit the updated file in `patches/`.

## Making Changes

1. **Fork** the repository and create a branch from `main`:
   ```bash
   git checkout -b fix/your-bug-description
   # or
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes.** Keep them focused — one fix or feature per PR.

3. **Test manually** against a running instance before opening a PR.

4. **Open a pull request** against `main` with a clear description of what changed and why.

## API and Docs Changes

When changing public API behavior, update the API implementation, OpenAPI output, dashboard docs, and README together so users see one consistent contract.

- Protected `/api/whatsapp/*` routes should continue to use the dual-auth model: dashboard bearer tokens or `X-API-Key`.
- Add or update `@hono/zod-openapi` schemas for any new request, response, or error shape.
- Run `npm run gen:swagger` after OpenAPI route/schema changes and commit the generated `openapi.json`. (It sets `WA_DISABLE_AUTOLOAD=true` so it does not open real WhatsApp connections.)
- When changing send-path behavior, update `src/lib/session-guard.ts` and `src/lib/send-guard.ts` together. New guard errors must be mapped to an HTTP status in `src/index.ts` (`app.onError`) and documented in `.env.example` and the README "Anti-ban Guards" section.
- Update `README.md` and the dashboard API docs when endpoint behavior changes.
- Keep examples copy-pasteable with `http://localhost:3000/api/whatsapp` as the local base URL.

### Session Webhook Contributions

Session webhooks are managed through:

| Method   | Path                                               | Purpose                   |
| -------- | -------------------------------------------------- | ------------------------- |
| `POST`   | `/api/whatsapp/sessions/{sessionId}/webhooks`      | Add an HTTPS webhook URL  |
| `GET`    | `/api/whatsapp/sessions/{sessionId}/webhooks`      | List session webhook URLs |
| `DELETE` | `/api/whatsapp/sessions/{sessionId}/webhooks/{id}` | Delete one webhook URL     |

Webhook URL configuration is persisted in `data/webhook_urls.json`. Incoming WhatsApp message events are transient and must not be stored in JSON files, databases, logs, or local storage.

When working on webhook code:

- Accept only absolute HTTPS URLs without fragments.
- Keep delivery session-scoped: only webhook URLs for the matching `sessionId` should receive the incoming message event.
- Do not expose API keys, bearer tokens, request headers, WhatsApp credential data, or other secrets in dashboard UI, OpenAPI examples, README examples, or webhook payload metadata.
- Duplicate URL creates should return `409` with `{ "error": "duplicate_webhook_url", "existingId": "..." }`.
- Keep the outbound `WebhookMessagePayload` documented with `event`, `sessionId`, `messageId`, `sender`, `recipient`, `timestamp`, `messageType`, `content`, and `raw`.

Recommended checks for webhook-related PRs:

```bash
npm run build
npm run gen:swagger
cd dashboard && npm run build
git diff --check
```

## Code Style

- TypeScript for all backend and dashboard code
- No linter is enforced yet — match the style of surrounding code
- Avoid unnecessary abstractions; prefer simple, direct code
- Keep components and functions small and focused

## Commit Messages

Use short, imperative sentences:

```
fix: session QR not refreshing after expiry
feat: add document send endpoint
docs: update API reference for pairing code
```

Prefix: `fix`, `feat`, `docs`, `refactor`, `chore`

## Reporting Bugs

Include in your issue:

- Steps to reproduce
- Expected vs actual behavior
- Node.js version, OS, Docker version (if applicable)
- Relevant logs or error messages

## Questions

Open a [GitHub Discussion](https://github.com/iniadil/waporta/discussions) for questions that aren't bugs or feature requests.
