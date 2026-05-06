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

export class WebhookManagerException extends Error {
  constructor(public readonly detail: WebhookManagerError) {
    super(detail.kind)
  }
}
