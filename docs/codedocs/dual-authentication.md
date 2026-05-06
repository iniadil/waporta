---
title: "Dual Authentication"
description: "How dashboard bearer tokens and external API keys coexist in waporta."
---

waporta uses two authentication modes because the built-in dashboard and external integrations have different lifecycles. Human operators log in through the dashboard and receive bearer tokens, while automation code typically needs a stable secret that survives browser sessions and can be rotated independently.

## What It Is

The auth layer is implemented in `src/routes/auth.ts`, `src/middleware/auth.ts`, and `src/apikeys.ts`.

- `src/routes/auth.ts` handles `/auth/login`, `/auth/logout`, and `/auth/check`.
- `src/middleware/auth.ts` exports `authMiddleware`, `apiKeyMiddleware`, and `dualAuthMiddleware`.
- `src/apikeys.ts` persists API keys under `data/api_keys.json`.

The dashboard-only endpoints use bearer tokens, while `/api/whatsapp/*` accepts either bearer tokens or API keys through `dualAuthMiddleware`.

## Why It Exists

The dashboard needs a simple login flow with a server-issued token. External systems need secrets that can be created once, stored in vaults, and sent from cron jobs, queues, or other services. Combining both into one middleware layer keeps the route tree consistent and avoids maintaining separate messaging endpoints for humans and machines.

## How It Works Internally

`tokenStore` in `src/middleware/auth.ts` is an in-memory `Set<string>`. `POST /auth/login` in `src/routes/auth.ts` compares the incoming username and password with `DASHBOARD_USERNAME` and `DASHBOARD_PASSWORD`, generates a 32-byte random token, and stores it in that set. `authMiddleware` simply checks whether the `Authorization` header starts with `Bearer ` and whether the token exists in `tokenStore`.

API keys work differently. `src/apikeys.ts` reads and writes `data/api_keys.json`, generates IDs with `randomBytes(8)`, generates secrets with a `wap_` prefix, and exposes `validateKey` for middleware use. `validateKey` also accepts `DEFAULT_API_KEY` from the environment, which provides a bootstrap credential before any dashboard-generated key exists.

```mermaid
flowchart TD
  A[Incoming request] --> B{Authorization bearer token?}
  B -->|Yes| C{Token in tokenStore?}
  C -->|Yes| D[Allow]
  C -->|No| E{X-API-Key valid?}
  B -->|No| E{X-API-Key valid?}
  E -->|Yes| D[Allow]
  E -->|No| F[401 Unauthorized]
```

## Basic Usage

Dashboard login:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}'
```

Successful response:

```json
{
  "token": "64_hex_characters..."
}
```

That token can then access authenticated dashboard routes:

```bash
curl http://localhost:3000/auth/check \
  -H "Authorization: Bearer 64_hex_characters..."
```

For machine clients, use an API key instead:

```bash
curl http://localhost:3000/api/whatsapp/sessions \
  -H "X-API-Key: wap_local_demo_key"
```

## Advanced Usage

A common production pattern is to create named API keys in the dashboard and use them from backend jobs instead of sharing operator tokens.

```ts
const token = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: process.env.WAPORTA_USER,
    password: process.env.WAPORTA_PASSWORD,
  }),
}).then((res) => res.json()).then((data) => data.token);

const createdKey = await fetch('http://localhost:3000/api/keys', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ name: 'nightly-sync' }),
}).then((res) => res.json());

console.log(createdKey);
```

The route is defined in `src/routes/apikeys.ts`. It returns the full secret only once when the key is created. Later, `listKeys()` masks secrets to `key.slice(0, 12) + '...'`, which is a deliberate safety measure for the dashboard.

<Callout type="warn">Bearer tokens are stored only in `tokenStore`, which lives in process memory. Restarting the server invalidates every dashboard session immediately. API keys survive restarts because they are backed by `data/api_keys.json` or `DEFAULT_API_KEY`.</Callout>

<Accordions>
<Accordion title="In-memory bearer tokens vs persistent sessions">
The current bearer-token implementation is intentionally minimal. `src/routes/auth.ts` does not issue refresh tokens, sign JWTs, or persist sessions to disk, which keeps the dashboard auth path easy to audit and avoids extra dependencies. The downside is operational: a restart logs everyone out, and there is no built-in token expiration beyond explicit logout or process death. For a small self-hosted admin console, that trade-off is reasonable. For a multi-operator environment with SSO or audit requirements, this auth layer would need a more durable session store and stronger credential management.
</Accordion>
<Accordion title="Static default key vs generated API keys">
`DEFAULT_API_KEY` is the fastest way to bootstrap the system because it requires no dashboard login and works immediately after startup. It is also a blunt instrument: every external integration shares the same secret unless you replace it. Generated API keys from `src/apikeys.ts` are named, individually revocable, and persisted to `data/api_keys.json`, which makes them better for real environments. The trade-off is that the full key is only visible at creation time, so your provisioning flow needs to capture it and store it securely. If you lose it later, the codebase expects you to revoke and recreate it rather than recover it.
</Accordion>
</Accordions>

For the operational workflow that uses these credentials end to end, continue to [Connect, Send, and Check](/docs/guides/connect-send-and-check).
