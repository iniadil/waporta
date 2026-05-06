import { apiFetch } from './client'

export interface WebhookUrlRecord {
  id: string
  sessionId: string
  url: string
  normalizedUrl: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateWebhookUrlRequest {
  url: string
}

export interface DeleteWebhookUrlResponse {
  id: string
  sessionId: string
}

function sessionWebhookPath(sessionId: string) {
  return `/sessions/${encodeURIComponent(sessionId)}/webhooks`
}

export const listWebhookUrls = (sessionId: string) =>
  apiFetch<WebhookUrlRecord[]>(sessionWebhookPath(sessionId))

export const createWebhookUrl = (sessionId: string, url: string) =>
  apiFetch<WebhookUrlRecord>(sessionWebhookPath(sessionId), {
    method: 'POST',
    body: JSON.stringify({ url } satisfies CreateWebhookUrlRequest),
  })

export const deleteWebhookUrl = (sessionId: string, id: string) =>
  apiFetch<DeleteWebhookUrlResponse>(
    `${sessionWebhookPath(sessionId)}/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
