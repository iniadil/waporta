import { randomBytes } from 'crypto'
import type { WebhookUrlRecord } from './types.js'
import { WebhookManagerException } from './types.js'
import { validateSessionId, validateWebhookUrl, normalizeUrl } from './url-normalization.js'
import type { WebhookUrlStore } from './store.js'

export class WebhookUrlManager {
  constructor(private readonly store: WebhookUrlStore) {}

  isOperational(): boolean {
    return this.store.isOperational()
  }

  async create(sessionId: string, input: { url: string }): Promise<WebhookUrlRecord> {
    const validSessionId = validateSessionId(sessionId)
    const validUrl = validateWebhookUrl(input.url)
    const normalized = normalizeUrl(validUrl)

    return this.store.mutate<WebhookUrlRecord>((records) => {
      const existing = records.find(
        (r) => r.sessionId === validSessionId && r.normalizedUrl === normalized,
      )
      if (existing) {
        throw new WebhookManagerException({ kind: 'duplicate', existingId: existing.id })
      }
      const now = new Date().toISOString()
      const record: WebhookUrlRecord = {
        id: randomBytes(8).toString('hex'),
        sessionId: validSessionId,
        url: validUrl.toString(),
        normalizedUrl: normalized,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      }
      return { records: [...records, record], result: { ...record } }
    })
  }

  async list(sessionId: string): Promise<WebhookUrlRecord[]> {
    const validSessionId = validateSessionId(sessionId)
    return this.store
      .snapshot()
      .filter((r) => r.sessionId === validSessionId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((r) => ({ ...r }))
  }

  async delete(sessionId: string, id: string): Promise<{ id: string; sessionId: string }> {
    const validSessionId = validateSessionId(sessionId)

    return this.store.mutate<{ id: string; sessionId: string }>((records) => {
      const idx = records.findIndex((r) => r.id === id && r.sessionId === validSessionId)
      if (idx === -1) {
        throw new WebhookManagerException({ kind: 'not_found' })
      }
      const next = [...records]
      next.splice(idx, 1)
      return { records: next, result: { id, sessionId: validSessionId } }
    })
  }

  listEnabledForSession(sessionId: string): WebhookUrlRecord[] {
    return this.store
      .snapshot()
      .filter((r) => r.sessionId === sessionId && r.enabled)
      .map((r) => ({ ...r }))
  }
}
