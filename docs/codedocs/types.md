---
title: "Types"
description: "The exported TypeScript interfaces and types that define waporta's data contracts."
---

waporta is primarily a server application, but it still exports a useful set of TypeScript interfaces and types across its utility and webhook modules. This page collects the definitions exactly as they appear in source and explains how each contract is used.

## `src/apikeys.ts`

Import path:

```ts
import type { ApiKey, ApiKeyMasked } from './src/apikeys.js';
```

```ts
export interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
}

export interface ApiKeyMasked {
  id: string
  name: string
  maskedKey: string
  createdAt: string
}
```

`ApiKey` is returned only when a key is created. `ApiKeyMasked` is the safer listing shape used by the dashboard so previously issued secrets are not exposed again.

## `src/lib/retry.ts`

Import path:

```ts
import type { RetryOptions } from './src/lib/retry.js';
```

```ts
export interface RetryOptions {
  maxRetries: number
  baseDelay: number
  isRetryable: (err: unknown) => boolean
}
```

This type defines the generic retry contract. The WhatsApp-specific wrapper in `src/lib/send-with-retry.ts` supplies a concrete classifier and delay policy.

## `src/lib/notifier.ts`

Import path:

```ts
import type { FailureDetails, Notifier } from './src/lib/notifier.js';
```

```ts
export interface FailureDetails {
  sessionId: string
  to: string
  messageType: 'text' | 'image' | 'document'
  error: string
  attempts: number
  timestamp: string
}

export interface Notifier {
  name: string
  notify(details: FailureDetails): Promise<void>
}
```

`FailureDetails` is the payload shape sent to email and webhook notifiers. `Notifier` is the minimal interface required by `NotifierRegistry.register(...)`, which means you can add custom notifiers without changing the registry code.

## `src/webhooks/types.ts`

Import path:

```ts
import type {
  WebhookUrlRecord,
  WebhookUrlStoreFile,
  IncomingMessageEvent,
  WebhookMessagePayload,
  WebhookDispatchResult,
  WebhookManagerError,
} from './src/webhooks/types.js';
```

```ts
export interface WebhookUrlRecord {
  id: string
  sessionId: string
  url: string
  normalizedUrl: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface WebhookUrlStoreFile {
  version: 1
  records: WebhookUrlRecord[]
}

export interface IncomingMessageEvent {
  sessionId: string
  id?: string
  messageId?: string
  from?: string
  to?: string
  timestamp?: number | string
  type?: string
  messageType?: string
  content?: unknown
  message?: unknown
  raw: unknown
}

export interface WebhookMessagePayload {
  event: 'message.received'
  sessionId: string
  messageId?: string
  sender?: string
  recipient?: string
  timestamp?: number | string
  messageType?: string
  content?: unknown
  raw: unknown
}

export interface WebhookDispatchResult {
  sessionId: string
  attempted: number
  delivered: number
  failed: Array<{ webhookId: string; url: string; error: string; status?: number }>
}

export type WebhookManagerError =
  | { kind: 'invalid_session'; message: string }
  | { kind: 'invalid_url'; message: string }
  | { kind: 'duplicate'; existingId: string }
  | { kind: 'not_found' }
  | { kind: 'store_unavailable' }
```

How to read these types:

- `WebhookUrlRecord` is the persisted registration record returned by create and list endpoints.
- `WebhookUrlStoreFile` is the on-disk container written to `data/webhook_urls.json`.
- `IncomingMessageEvent` is the normalized event shape passed from `src/wa.ts` into the dispatcher.
- `WebhookMessagePayload` is the outbound JSON body delivered to your webhook receiver.
- `WebhookDispatchResult` summarizes delivery outcomes per dispatch attempt.
- `WebhookManagerError` is the discriminated union wrapped by `WebhookManagerException`.

## Error Class

Import path:

```ts
import { WebhookManagerException } from './src/webhooks/types.js';
```

```ts
export class WebhookManagerException extends Error {
  constructor(public readonly detail: WebhookManagerError) {
    super(detail.kind)
  }
}
```

This class is important because `src/routes/webhooks.ts` branches on `detail.kind` to decide whether a failure becomes `400`, `404`, `409`, or `500`.

## Practical Guidance

If you are consuming only the HTTP API, you will mostly see JSON representations of these types in route responses. If you are extending the codebase internally, these types define the contract boundaries between route handlers, persistence modules, and the webhook dispatcher. The most important thing to preserve when modifying them is compatibility across those boundaries. For example, changing `WebhookMessagePayload` affects both the dispatcher and every downstream webhook consumer.

Related pages: [Webhook System](/docs/api-reference/webhook-system) and [Retry and Notifications](/docs/api-reference/retry-and-notifications).
