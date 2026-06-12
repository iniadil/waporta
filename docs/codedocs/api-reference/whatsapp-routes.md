---
title: "WhatsApp Routes"
description: "Reference for the session and messaging endpoints, plus the shared WhatsApp runtime and QR helpers."
---

This page covers:

- `src/routes/whatsapp.ts`
- `src/wa.ts`
- `src/events.ts`

These modules provide the main operational API for sessions and outbound messaging.

## Module: `src/wa.ts`

Default export:

```ts
import wa from './src/wa.js';
```

Signature:

```ts
const wa: Whatsapp;
export default wa;
```

The shared runtime is constructed with:

```ts
new Whatsapp({
  adapter: new SQLiteAdapter(),
  onConnecting,
  onConnected,
  onDisconnected,
  onQRUpdated,
  onMessageReceived,
});
```

Notable behaviors:

- `onConnected` clears cached QR state through `clearQR(sessionId)`.
- `onQRUpdated` stores the latest QR string through `onQR`.
- `onMessageReceived` forwards a normalized event to `webhookDispatcher.dispatch(...)`.

## Module: `src/events.ts`

### `setPendingSession`

Import path:

```ts
import { setPendingSession } from './src/events.js';
```

Signature:

```ts
export function setPendingSession(_id: string): void;
```

Current behavior: no-op.

### `onQR`

```ts
export function onQR(sessionId: string, qr: string): void;
```

Stores the latest QR string for a session.

### `getQR`

```ts
export function getQR(id: string): string | null;
```

Returns the cached QR string or `null`.

### `clearQR`

```ts
export function clearQR(id: string): void;
```

Removes cached QR state after a session connects.

## Module: `src/routes/whatsapp.ts`

Default export:

```ts
import whatsappRoutes from './src/routes/whatsapp.js';
```

Signature:

```ts
const app: OpenAPIHono;
export default app;
```

### Session endpoints

#### `GET /api/whatsapp/sessions`

Response:

```ts
{ sessions: string[] }
```

Lists session IDs from `wa.getSessionsIds()`.

#### `POST /api/whatsapp/sessions/{sessionId}`

Parameters table:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sessionId` | `string` | — | Session identifier passed to `wa.startSession(sessionId)`. |

Response:

```ts
{ status: string; sessionId: string }
```

#### `GET /api/whatsapp/sessions/{sessionId}/qr`

Response:

```ts
{ qr: string | null }
```

#### `POST /api/whatsapp/sessions/{sessionId}/pairing-code`

Body:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `phoneNumber` | `string` | — | Phone number used by `wa.startSessionWithPairingCode`. |

Response:

```ts
{ status: string; sessionId: string; pairingCode: string }
```

#### `GET /api/whatsapp/sessions/{sessionId}`

Response:

```ts
{
  sessionId: string;
  status: 'connecting' | 'connected' | 'disconnected';
  user: {
    id: string;
    name?: string;
    lid?: string;
  } | null;
}
```

#### `DELETE /api/whatsapp/sessions/{sessionId}`

Response:

```ts
{ status: string; sessionId: string }
```

### Messaging endpoints

#### `POST /api/whatsapp/send/text`

Body:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sessionId` | `string` | — | Active session ID. |
| `to` | `string` | — | Recipient phone number or JID. |
| `text` | `string` | — | Message body. |
| `isGroup` | `boolean` | optional | Sends to a group JID when `true`. |

Return type:

```ts
{ status: string } | { error: 'delivery_failed'; message: string; attempts: number }
```

#### `POST /api/whatsapp/send/image`

Body:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sessionId` | `string` | — | Active session ID. |
| `to` | `string` | — | Recipient phone number or JID. |
| `media` | `string` | — | Image URL or base64 content. |
| `text` | `string` | optional | Caption text. |
| `isGroup` | `boolean` | optional | Group-send flag. |

#### `POST /api/whatsapp/send/document`

Body:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sessionId` | `string` | — | Active session ID. |
| `to` | `string` | — | Recipient phone number or JID. |
| `media` | `string` | — | Document URL or base64 content. |
| `filename` | `string` | — | Filename sent to the recipient. |
| `text` | `string` | optional | Optional message text. |
| `isGroup` | `boolean` | optional | Group-send flag. |

#### `GET /api/whatsapp/check`

Query:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sessionId` | `string` | — | Session used for the lookup. |
| `to` | `string` | — | Number or JID to validate. |
| `isGroup` | `string` | optional | String form of the group flag, interpreted as `true` only when equal to `"true"`. |

Return type:

```ts
{ exists: boolean }
```

## Combined Usage Example

```ts
const apiKey = 'wap_local_demo_key';
const baseUrl = 'http://localhost:3000/api/whatsapp';

await fetch(`${baseUrl}/sessions/ops-bot`, {
  method: 'POST',
  headers: { 'X-API-Key': apiKey },
});

const qr = await fetch(`${baseUrl}/sessions/ops-bot/qr`, {
  headers: { 'X-API-Key': apiKey },
}).then((res) => res.json());

const send = await fetch(`${baseUrl}/send/text`, {
  method: 'POST',
  headers: {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sessionId: 'ops-bot',
    to: '6281234567890',
    text: 'Deployment finished',
  }),
}).then((res) => res.json());

console.log({ qr, send });
```

Related pages: [Session Lifecycle](/docs/session-lifecycle) and [Delivery Retries](/docs/delivery-retries).
