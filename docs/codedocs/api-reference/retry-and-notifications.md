---
title: "Retry and Notifications"
description: "Reference for retry helpers, send orchestration, notifier contracts, and failure delivery."
---

This page covers:

- `src/lib/retry.ts`
- `src/lib/send-with-retry.ts`
- `src/lib/notifier.ts`

## Module: `src/lib/retry.ts`

### `RetriesExhaustedError`

Import path:

```ts
import { RetriesExhaustedError } from './src/lib/retry.js';
```

Constructor signature:

```ts
export class RetriesExhaustedError extends Error {
  constructor(originalError: Error, attempts: number);
}
```

| Constructor option | Type | Default | Description |
|--------------------|------|---------|-------------|
| `originalError` | `Error` | — | Last failure seen by the retry loop. |
| `attempts` | `number` | — | Total number of attempts made. |

### `RetryOptions`

```ts
export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  isRetryable: (err: unknown) => boolean;
}
```

### `withRetry`

Import path:

```ts
import { withRetry } from './src/lib/retry.js';
```

Signature:

```ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T>;
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fn` | `() => Promise<T>` | — | Async operation to retry. |
| `opts.maxRetries` | `number` | — | Total attempts including the first call. |
| `opts.baseDelay` | `number` | — | Delay in milliseconds before exponential backoff is applied. |
| `opts.isRetryable` | `(err: unknown) => boolean` | — | Classifier that decides whether to continue retrying. |

Example:

```ts
const result = await withRetry(
  () => fetch('https://example.com').then((res) => res.text()),
  {
    maxRetries: 3,
    baseDelay: 1000,
    isRetryable: (err) => String(err).includes('timeout'),
  }
);
```

### `isRetryableWaError`

Import path:

```ts
import { isRetryableWaError } from './src/lib/retry.js';
```

Signature:

```ts
export function isRetryableWaError(err: unknown): boolean;
```

Uses message substring matching to classify WhatsApp send errors.

## Module: `src/lib/send-with-retry.ts`

### `sendWithRetry`

Import path:

```ts
import { sendWithRetry } from './src/lib/send-with-retry.js';
```

Signature:

```ts
export async function sendWithRetry(opts: {
  sessionId: string;
  to: string;
  messageType: 'text' | 'image' | 'document';
  sendFn: () => Promise<unknown>;
}): Promise<void>;
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sessionId` | `string` | — | Source session for logging and notifications. |
| `to` | `string` | — | Recipient identifier. |
| `messageType` | `'text' \| 'image' \| 'document'` | — | Message category used in logs and notifications. |
| `sendFn` | `() => Promise<unknown>` | — | Actual send operation delegated to `wa`. |

The module also re-exports:

```ts
export { RetriesExhaustedError };
```

Example:

```ts
await sendWithRetry({
  sessionId: 'ops-bot',
  to: '6281234567890',
  messageType: 'text',
  sendFn: async () => {
    console.log('pretend send');
  },
});
```

## Module: `src/lib/notifier.ts`

### `FailureDetails`

```ts
export interface FailureDetails {
  sessionId: string;
  to: string;
  messageType: 'text' | 'image' | 'document';
  error: string;
  attempts: number;
  timestamp: string;
}
```

### `Notifier`

```ts
export interface Notifier {
  name: string;
  notify(details: FailureDetails): Promise<void>;
}
```

### `NotifierRegistry`

Import path:

```ts
import { NotifierRegistry } from './src/lib/notifier.js';
```

Constructor signature:

```ts
export class NotifierRegistry {
  register(notifier: Notifier): void;
  notifyAll(details: FailureDetails): Promise<void>;
}
```

| Method | Parameters | Return type | Description |
|--------|------------|-------------|-------------|
| `register` | `notifier: Notifier` | `void` | Adds a notifier implementation to the registry. |
| `notifyAll` | `details: FailureDetails` | `Promise<void>` | Sends notifications in parallel with `Promise.allSettled`. |

### `registry`

Import path:

```ts
import { registry } from './src/lib/notifier.js';
```

Signature:

```ts
export const registry: NotifierRegistry;
```

`registry` is initialized at module load time by inspecting `SMTP_*`, `NOTIFY_EMAIL`, and `NOTIFY_WEBHOOK_URL`.

## Combined Usage Pattern

```ts
import { sendWithRetry } from './src/lib/send-with-retry.js';
import { registry } from './src/lib/notifier.js';

registry.register({
  name: 'debug',
  async notify(details) {
    console.log('failure', details);
  },
});

await sendWithRetry({
  sessionId: 'ops-bot',
  to: '6281234567890',
  messageType: 'text',
  sendFn: () => Promise.reject(new Error('timeout')),
});
```

This pattern is internal-facing rather than part of the HTTP API, but it is the exact logic used by the route handlers in `src/routes/whatsapp.ts`.
