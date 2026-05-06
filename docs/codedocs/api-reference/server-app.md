---
title: "Server App"
description: "Reference for the waporta server bootstrap and the composed Hono application."
---

This page covers the runtime entrypoints in `index.ts` and `src/index.ts`. They are the top-level modules that turn all lower-level route, auth, and webhook code into one HTTP server.

## Module: `index.ts`

Source file: `index.ts`

Signature:

```ts
import { serve } from '@hono/node-server';
import app from './src/index.js';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`);
});
```

This file does not export symbols. Its job is to read `PORT`, hand `app.fetch` to Hono’s Node adapter, and start the process.

## Module: `src/index.ts`

Source file: `src/index.ts`

### `openAPIConfig`

Import path:

```ts
import { openAPIConfig } from './src/index.js';
```

Signature:

```ts
export const openAPIConfig: {
  openapi: '3.0.0';
  info: {
    title: string;
    version: string;
    description: string;
  };
};
```

`openAPIConfig` is consumed by `app.doc('/openapi.json', openAPIConfig)` and by `scripts/gen-swagger.ts`. The `version` value is loaded from `package.json` using `createRequire`.

### Default export: `app`

Import path:

```ts
import app from './src/index.js';
```

Signature:

```ts
const app: OpenAPIHono;
export default app;
```

The default export is the full Hono application. It mounts:

| Route / middleware | Source | Purpose |
|--------------------|--------|---------|
| `logger()` | `src/index.ts` | Request logging for all paths. |
| `prettyJSON()` | `src/index.ts` | Formatted JSON responses in development and diagnostics. |
| `cors({ origin: "http://localhost:5173" })` on `/api/*` and `/auth/*` | `src/index.ts` | Allows the Vite dashboard to call the backend in local development. |
| `/auth` | `src/routes/auth.ts` | Dashboard login, logout, and auth check. |
| `/api/keys` | `src/routes/apikeys.ts` | API key management behind bearer auth. |
| `/api/whatsapp` | `src/routes/whatsapp.ts` | Session, messaging, and number-check endpoints. |
| `/api/whatsapp` | `src/routes/webhooks.ts` | Session webhook management routes. |
| `/openapi.json` | `src/index.ts` | OpenAPI document generated from route metadata. |
| `/doc` | `src/index.ts` | Swagger UI for the generated spec. |
| `/dashboard/*` | `src/index.ts` | Static frontend assets from `dashboard/dist`. |

## Request Flow Example

```ts
const response = await app.request('/api/whatsapp/sessions', {
  headers: { 'X-API-Key': 'wap_local_demo_key' },
});

console.log(response.status);
console.log(await response.json());
```

That in-process usage works because Hono apps expose the `fetch` contract directly. It is useful for tests or internal scripts, even though this repository does not currently ship a dedicated test suite around the app export.

## Error Handling

`src/index.ts` installs:

- `app.notFound((c) => c.json({ error: 'Not Found' }, 404))`
- `app.onError(...)`

The error handler special-cases `SyntaxError` to return `400 Invalid or missing JSON body`. Everything else becomes a `500` with `err.message`. That behavior is intentionally simple and means route modules should convert expected operational errors into explicit JSON responses before throwing.

## Related Modules

- [Auth and API Keys](/docs/api-reference/auth-and-api-keys)
- [WhatsApp Routes](/docs/api-reference/whatsapp-routes)
- [Webhook System](/docs/api-reference/webhook-system)
