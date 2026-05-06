import type { IncomingMessageEvent, WebhookMessagePayload, WebhookDispatchResult } from './types.js'
import type { WebhookUrlManager } from './manager.js'

const SECRET_KEY_RE = /^(authorization|x-api-key|apikey|token|password|secret)$/i

function redactSecrets(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(redactSecrets)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY_RE.test(k) ? '[REDACTED]' : redactSecrets(v)
  }
  return out
}

export class WebhookEventDispatcher {
  constructor(private readonly manager: WebhookUrlManager) {}

  buildPayload(event: IncomingMessageEvent): WebhookMessagePayload {
    return {
      event: 'message.received',
      sessionId: event.sessionId,
      messageId: event.messageId ?? event.id,
      sender: event.from,
      recipient: event.to,
      timestamp: event.timestamp,
      messageType: event.messageType ?? event.type,
      content: redactSecrets(event.content ?? event.message),
      raw: redactSecrets(event.raw),
    }
  }

  async dispatch(event: IncomingMessageEvent): Promise<WebhookDispatchResult> {
    const result: WebhookDispatchResult = {
      sessionId: event.sessionId,
      attempted: 0,
      delivered: 0,
      failed: [],
    }
    try {
      const webhooks = this.manager.listEnabledForSession(event.sessionId)
      if (webhooks.length === 0) return result

      const payload = this.buildPayload(event)
      const body = JSON.stringify(payload)
      result.attempted = webhooks.length

      const outcomes = await Promise.allSettled(
        webhooks.map(async (wh) => {
          let res: Response
          try {
            res = await fetch(wh.url, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body,
              signal: AbortSignal.timeout(10_000),
            })
          } catch (err) {
            throw { webhookId: wh.id, url: wh.url, error: String(err) }
          }
          if (!res.ok) {
            throw { webhookId: wh.id, url: wh.url, error: `HTTP ${res.status}`, status: res.status }
          }
          return wh.id
        }),
      )

      for (const outcome of outcomes) {
        if (outcome.status === 'fulfilled') {
          result.delivered++
        } else {
          const r = outcome.reason as { webhookId: string; url: string; error: string; status?: number }
          result.failed.push(r)
          console.error(`[webhook-dispatch] failed sessionId=${event.sessionId} webhookId=${r.webhookId} error=${r.error}`)
        }
      }

      if (result.failed.length === result.attempted) {
        console.error(
          `[webhook-dispatch] all ${result.attempted} webhooks failed for sessionId=${event.sessionId}`,
        )
      }
    } catch (err) {
      console.error('[webhook-dispatch] unexpected error:', err)
    }
    return result
  }
}
