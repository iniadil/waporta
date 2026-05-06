---
title: "Connect, Send, and Check"
description: "Create a session, authenticate, send messages, and verify numbers through the REST API."
---

This guide covers the core operator flow after the server is running: create a session, authenticate to the API, send outbound messages, and verify whether a number exists on WhatsApp.

## Problem

You need a repeatable sequence that proves the system is operational end to end, not just that the HTTP server responds.

## Solution

Create a named session, connect it with either a QR code or pairing code, then use the same `sessionId` for send and check operations.

<Steps>
<Step>
### Authenticate

Use either a bootstrap API key or a dashboard bearer token.

```bash
export BASE_URL=http://localhost:3000
export API_KEY=wap_local_demo_key
```

</Step>
<Step>
### Create a session

```bash
curl -X POST "$BASE_URL/api/whatsapp/sessions/sales-bot" \
  -H "X-API-Key: $API_KEY"
```

</Step>
<Step>
### Connect the session

QR flow:

```bash
curl "$BASE_URL/api/whatsapp/sessions/sales-bot/qr" \
  -H "X-API-Key: $API_KEY"
```

Pairing-code flow:

```bash
curl -X POST "$BASE_URL/api/whatsapp/sessions/sales-bot/pairing-code" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"6281234567890"}'
```

</Step>
<Step>
### Send and verify

```bash
curl -X POST "$BASE_URL/api/whatsapp/send/text" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sales-bot","to":"6281234567890","text":"Hello from waporta"}'

curl "$BASE_URL/api/whatsapp/check?sessionId=sales-bot&to=6281234567890" \
  -H "X-API-Key: $API_KEY"
```

</Step>
</Steps>

## Complete Runnable Example

The following Node script exercises the most useful routes from `src/routes/whatsapp.ts`:

```ts
const baseUrl = 'http://localhost:3000';
const apiKey = process.env.WAPORTA_API_KEY ?? 'wap_local_demo_key';
const headers = { 'X-API-Key': apiKey, 'Content-Type': 'application/json' };

await fetch(`${baseUrl}/api/whatsapp/sessions/sales-bot`, {
  method: 'POST',
  headers: { 'X-API-Key': apiKey },
});

const status = await fetch(`${baseUrl}/api/whatsapp/sessions/sales-bot`, {
  headers: { 'X-API-Key': apiKey },
}).then((res) => res.json());

const exists = await fetch(
  `${baseUrl}/api/whatsapp/check?sessionId=sales-bot&to=6281234567890`,
  { headers: { 'X-API-Key': apiKey } }
).then((res) => res.json());

const sendResult = await fetch(`${baseUrl}/api/whatsapp/send/text`, {
  method: 'POST',
  headers,
  body: JSON.stringify({
    sessionId: 'sales-bot',
    to: '6281234567890',
    text: 'Hello from waporta',
  }),
}).then((res) => res.json());

console.log({ status, exists, sendResult });
```

## Media and Documents

waporta also exposes:

- `POST /api/whatsapp/send/image`
- `POST /api/whatsapp/send/document`

The route handlers map directly to `wa.sendImage` and `wa.sendDocument` through `sendWithRetry`. The `media` field accepts a URL or base64 string, and document sends add a required `filename`.

```bash
curl -X POST "$BASE_URL/api/whatsapp/send/document" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId":"sales-bot",
    "to":"6281234567890",
    "media":"https://example.com/invoice.pdf",
    "filename":"invoice.pdf",
    "text":"Your invoice"
  }'
```

If a send fails after the retry budget, the route returns `502` with `error: "delivery_failed"` and the number of attempts. That response is generated in `src/routes/whatsapp.ts` and is your signal to inspect session health or notifier outputs.

The inbound half of a connected session is covered in [Receive Webhooks and Alerts](/docs/guides/receive-webhooks-and-alerts).
