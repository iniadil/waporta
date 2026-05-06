---
title: "Auth and API Keys"
description: "Reference for dashboard auth routes, auth middleware, and persistent API key utilities."
---

This page covers four source modules:

- `src/routes/auth.ts`
- `src/middleware/auth.ts`
- `src/apikeys.ts`
- `src/routes/apikeys.ts`

They collectively implement dashboard login, bearer-token validation, API key persistence, and API key management routes.

## Module: `src/middleware/auth.ts`

### `tokenStore`

Import path:

```ts
import { tokenStore } from './src/middleware/auth.js';
```

Signature:

```ts
export const tokenStore: Set<string>;
```

The dashboard bearer-token store lives only in memory.

### `authMiddleware`

Import path:

```ts
import { authMiddleware } from './src/middleware/auth.js';
```

Signature:

```ts
export async function authMiddleware(c: Context, next: Next): Promise<Response | void>;
```

Behavior:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `c` | `Context` | — | Hono request context. |
| `next` | `Next` | — | Continuation for the next middleware or handler. |

Returns `401` unless the `Authorization` header starts with `Bearer ` and the token exists in `tokenStore`.

### `apiKeyMiddleware`

Import path:

```ts
import { apiKeyMiddleware } from './src/middleware/auth.js';
```

Signature:

```ts
export async function apiKeyMiddleware(c: Context, next: Next): Promise<Response | void>;
```

Validates `X-API-Key` using `validateKey`.

### `dualAuthMiddleware`

Import path:

```ts
import { dualAuthMiddleware } from './src/middleware/auth.js';
```

Signature:

```ts
export async function dualAuthMiddleware(c: Context, next: Next): Promise<Response | void>;
```

Accepts either a valid bearer token or a valid API key. This middleware protects all `/api/whatsapp/*` routes in `src/index.ts`.

Usage example:

```ts
app.use('/api/whatsapp/*', dualAuthMiddleware);
```

## Module: `src/apikeys.ts`

### `ApiKey`

```ts
export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
}
```

### `ApiKeyMasked`

```ts
export interface ApiKeyMasked {
  id: string;
  name: string;
  maskedKey: string;
  createdAt: string;
}
```

### `listKeys`

Import path:

```ts
import { listKeys } from './src/apikeys.js';
```

Signature:

```ts
export function listKeys(): ApiKeyMasked[];
```

Returns every stored key with the secret masked to the first twelve characters.

### `createKey`

Import path:

```ts
import { createKey } from './src/apikeys.js';
```

Signature:

```ts
export function createKey(name: string): ApiKey;
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `string` | — | Human-readable label stored with the key. |

The generated secret has the format `wap_` plus 24 random bytes in hex.

### `deleteKey`

Import path:

```ts
import { deleteKey } from './src/apikeys.js';
```

Signature:

```ts
export function deleteKey(id: string): boolean;
```

Returns `true` if the key existed and was removed.

### `validateKey`

Import path:

```ts
import { validateKey } from './src/apikeys.js';
```

Signature:

```ts
export function validateKey(key: string): boolean;
```

Checks the runtime value against `DEFAULT_API_KEY` first, then against `data/api_keys.json`.

Usage example:

```ts
const ok = validateKey(process.env.WAPORTA_API_KEY ?? '');
```

## Module: `src/routes/auth.ts`

Default export:

```ts
import authRoutes from './src/routes/auth.js';
```

Signature:

```ts
const app: Hono;
export default app;
```

Routes:

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/auth/login` | `{ username: string, password: string }` | `{ token: string }` or `401`. |
| `POST` | `/auth/logout` | none | `{ ok: true }` when the bearer token is removed. |
| `GET` | `/auth/check` | none | `{ ok: true }` when the bearer token is valid. |

Usage example:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme"}'
```

## Module: `src/routes/apikeys.ts`

Default export:

```ts
import apiKeysRoutes from './src/routes/apikeys.js';
```

Signature:

```ts
const app: Hono;
export default app;
```

Routes:

| Method | Path | Body | Response |
|--------|------|------|----------|
| `GET` | `/api/keys` | none | `ApiKeyMasked[]`. |
| `POST` | `/api/keys` | `{ name: string }` | `ApiKey` and `201`, or `400` when the name is empty. |
| `DELETE` | `/api/keys/:id` | none | `{ ok: true }` or `404`. |

Example combining login and key creation:

```ts
const token = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'changeme' }),
}).then((res) => res.json()).then((data) => data.token);

const key = await fetch('http://localhost:3000/api/keys', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ name: 'worker' }),
}).then((res) => res.json());

console.log(key);
```

Related pages: [Server App](/docs/api-reference/server-app) and [Types](/docs/types).
