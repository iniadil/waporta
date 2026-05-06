---
title: "Webhook System"
description: "Reference for webhook routes, validation helpers, storage, manager, dispatcher, and singleton exports."
---

This page covers the entire webhook subsystem:

- `src/routes/webhooks.ts`
- `src/webhooks/types.ts`
- `src/webhooks/url-normalization.ts`
- `src/webhooks/store.ts`
- `src/webhooks/manager.ts`
- `src/webhooks/dispatcher.ts`
- `src/webhooks/singletons.ts`

## Module: `src/routes/webhooks.ts`

### `createWebhookRoutes`

Import path:

```ts
import { createWebhookRoutes } from './src/routes/webhooks.js';
```

Signature:

```ts
export function createWebhookRoutes(manager: WebhookUrlManager): OpenAPIHono;
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `manager` | `WebhookUrlManager` | — | Operational manager used by all route handlers. |

This factory returns an `OpenAPIHono` app with three routes:

| Method | Path | Body | Response |
|--------|------|------|----------|
| `POST` | `/api/whatsapp/sessions/{sessionId}/webhooks` | `{ url: string }` | `WebhookUrlRecord` and `201`, `400`, `409`, or `500`. |
| `GET` | `/api/whatsapp/sessions/{sessionId}/webhooks` | none | `WebhookUrlRecord[]`. |
| `DELETE` | `/api/whatsapp/sessions/{sessionId}/webhooks/{id}` | none | `{ id: string; sessionId: string }` or `404`. |

Example:

```ts
const routes = createWebhookRoutes(webhookManager);
app.route('/api/whatsapp', routes);
```

## Module: `src/webhooks/url-normalization.ts`

### `validateSessionId`

```ts
export function validateSessionId(raw: unknown): string;
```

Rejects non-strings and strings outside the `1` to `128` character range.

### `validateWebhookUrl`

```ts
export function validateWebhookUrl(raw: unknown): URL;
```

Rejects blank, non-absolute, non-HTTPS, missing-host, fragmented, or longer-than-`2048` URLs.

### `normalizeUrl`

```ts
export function normalizeUrl(url: URL): string;
```

Normalization rules:

- Lowercase scheme and hostname.
- Remove port `443`.
- Strip the trailing slash from the root path.
- Preserve explicit paths and query strings.

Example:

```ts
const normalized = normalizeUrl(new URL('https://Example.com:443/?v=1'));
console.log(normalized); // https://example.com?v=1
```

## Module: `src/webhooks/store.ts`

### `WebhookUrlStore`

Import path:

```ts
import { WebhookUrlStore } from './src/webhooks/store.js';
```

Constructor signature:

```ts
export class WebhookUrlStore {
  init(): void;
  isOperational(): boolean;
  snapshot(): WebhookUrlRecord[];
  mutate<T>(
    fn: (records: WebhookUrlRecord[]) => {
      records: WebhookUrlRecord[];
      result: T;
    }
  ): Promise<T>;
}
```

Method reference:

| Method | Parameters | Return type | Description |
|--------|------------|-------------|-------------|
| `init()` | none | `void` | Loads `data/webhook_urls.json` and marks the store unavailable on parse errors. |
| `isOperational()` | none | `boolean` | Whether the store loaded successfully. |
| `snapshot()` | none | `WebhookUrlRecord[]` | Immutable copy of current records. |
| `mutate(fn)` | updater callback | `Promise<T>` | Serializes write operations through an internal promise tail and persists via temp-file rename. |

## Module: `src/webhooks/manager.ts`

### `WebhookUrlManager`

Import path:

```ts
import { WebhookUrlManager } from './src/webhooks/manager.js';
```

Constructor signature:

```ts
export class WebhookUrlManager {
  constructor(store: WebhookUrlStore);
  isOperational(): boolean;
  create(sessionId: string, input: { url: string }): Promise<WebhookUrlRecord>;
  list(sessionId: string): Promise<WebhookUrlRecord[]>;
  delete(sessionId: string, id: string): Promise<{ id: string; sessionId: string }>;
  listEnabledForSession(sessionId: string): WebhookUrlRecord[];
}
```

| Constructor option | Type | Default | Description |
|--------------------|------|---------|-------------|
| `store` | `WebhookUrlStore` | — | Persistence backend used for all CRUD operations. |

Usage example:

```ts
const store = new WebhookUrlStore();
store.init();

const manager = new WebhookUrlManager(store);
await manager.create('sales-bot', { url: 'https://example.com/incoming/whatsapp' });
```

## Module: `src/webhooks/dispatcher.ts`

### `WebhookEventDispatcher`

Import path:

```ts
import { WebhookEventDispatcher } from './src/webhooks/dispatcher.js';
```

Constructor signature:

```ts
export class WebhookEventDispatcher {
  constructor(manager: WebhookUrlManager);
  buildPayload(event: IncomingMessageEvent): WebhookMessagePayload;
  dispatch(event: IncomingMessageEvent): Promise<WebhookDispatchResult>;
}
```

| Constructor option | Type | Default | Description |
|--------------------|------|---------|-------------|
| `manager` | `WebhookUrlManager` | — | Provides enabled webhook URLs per session. |

`buildPayload` maps inbound message fields and redacts secret-looking keys recursively from `content` and `raw`. `dispatch` POSTs the same serialized body to every enabled URL in parallel.

Advanced example:

```ts
const result = await webhookDispatcher.dispatch({
  sessionId: 'sales-bot',
  id: 'ABC123',
  from: '6281234567890@s.whatsapp.net',
  to: '6289876543210@s.whatsapp.net',
  type: 'text',
  message: { text: 'hello', authorization: 'secret' },
  raw: { nested: { token: 'secret' } },
});

console.log(result);
```

## Module: `src/webhooks/singletons.ts`

Exports:

```ts
export const webhookStore = new WebhookUrlStore();
export const webhookManager = new WebhookUrlManager(webhookStore);
export const webhookDispatcher = new WebhookEventDispatcher(webhookManager);
```

Import path:

```ts
import {
  webhookStore,
  webhookManager,
  webhookDispatcher,
} from './src/webhooks/singletons.js';
```

`webhookStore.init()` is called once at module load time, which is why `src/index.ts` can mount `createWebhookRoutes(webhookManager)` immediately.

## Module: `src/webhooks/types.ts`

This module exports the data contracts used by the manager and dispatcher. Full definitions are collected on the [Types](/docs/types) page, but the operational pieces are:

- `WebhookUrlRecord`
- `IncomingMessageEvent`
- `WebhookMessagePayload`
- `WebhookDispatchResult`
- `WebhookManagerError`
- `WebhookManagerException`

`WebhookManagerException` is the error type that `src/routes/webhooks.ts` inspects in `mapError(...)` to produce `400`, `404`, `409`, and `500` responses.

Related pages: [Session Webhooks](/docs/session-webhooks) and [Types](/docs/types).
