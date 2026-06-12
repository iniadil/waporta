---
title: "Receive Webhooks and Alerts"
description: "Register inbound message webhooks and configure failure notifications for production use."
---

This guide combines the two event channels in waporta: inbound message webhooks for your application logic and outbound failure notifications for your operations channel.

## Problem

You need to:

- Receive incoming WhatsApp messages in your own service.
- Register those receivers per session.
- Be notified when outbound sends fail after waporta has exhausted retries.

## Solution

Use the webhook management routes from `src/routes/webhooks.ts` for inbound messages, and configure the notifier environment variables from `.env.example` for outbound failure alerts.

<Steps>
<Step>
### Create an inbound receiver

```ts
import { Hono } from 'hono';

const app = new Hono();

app.post('/incoming/whatsapp', async (c) => {
  const payload = await c.req.json();
  console.log('event', payload.event);
  console.log('session', payload.sessionId);
  console.log('sender', payload.sender);
  return c.json({ ok: true });
});

export default app;
```

</Step>
<Step>
### Register the receiver for a session

```bash
curl -X POST http://localhost:3000/api/whatsapp/sessions/sales-bot/webhooks \
  -H "X-API-Key: wap_local_demo_key" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/incoming/whatsapp"}'
```

</Step>
<Step>
### Configure failure alerts

```bash
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
### Verify the configuration

List the registered webhooks:

```bash
curl http://localhost:3000/api/whatsapp/sessions/sales-bot/webhooks \
  -H "X-API-Key: wap_local_demo_key"
```

Then trigger a known failure case, such as sending from a disconnected session, and inspect the logs or your notifier receiver.

</Step>
</Steps>

## Complete Runnable Example

This receiver handles both inbound message events from waporta and failure notifications sent by `WebhookNotifier`:

```ts
import { Hono } from 'hono';

const app = new Hono();

app.post('/incoming/whatsapp', async (c) => {
  const payload = await c.req.json();
  if (payload.event !== 'message.received') {
    return c.json({ error: 'unsupported event' }, 400);
  }

  console.log('incoming message', {
    sessionId: payload.sessionId,
    sender: payload.sender,
    messageType: payload.messageType,
  });

  return c.json({ ok: true });
});

app.post('/waporta/failures', async (c) => {
  const payload = await c.req.json();
  console.log('delivery failure', payload);
  return c.json({ ok: true });
});

export default app;
```

## Operational Notes

`WebhookEventDispatcher` redacts secret-looking keys recursively before sending webhook payloads, but you should still treat the payload as potentially sensitive because `raw` contains a sanitized copy of the original event. Return a fast `2xx` response from your receiver. The dispatcher uses `AbortSignal.timeout(10_000)`, so a slow receiver is treated as a failure and logged.

Failure notifications are separate from inbound message webhooks. They come from `NotifierRegistry` in `src/lib/notifier.ts`, not from the webhook dispatcher. That separation is useful because it lets you send operations alerts to a different system than the one that processes incoming chat messages.

If you need the exact payload and method signatures behind these features, read [Webhook System](/docs/api-reference/webhook-system) and [Retry and Notifications](/docs/api-reference/retry-and-notifications).
