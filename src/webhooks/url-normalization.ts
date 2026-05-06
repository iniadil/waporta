import { WebhookManagerException } from './types.js'

const MAX_SESSION_LEN = 128
const MAX_URL_LEN = 2048

export function validateSessionId(raw: unknown): string {
  if (typeof raw !== 'string') {
    throw new WebhookManagerException({ kind: 'invalid_session', message: 'sessionId must be a string' })
  }
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_SESSION_LEN) {
    throw new WebhookManagerException({
      kind: 'invalid_session',
      message: `sessionId must be 1–${MAX_SESSION_LEN} characters`,
    })
  }
  return trimmed
}

export function validateWebhookUrl(raw: unknown): URL {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.trim().length > MAX_URL_LEN) {
    throw new WebhookManagerException({
      kind: 'invalid_url',
      message: `url must be an HTTPS URL up to ${MAX_URL_LEN} characters`,
    })
  }
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    throw new WebhookManagerException({ kind: 'invalid_url', message: 'url must be a valid absolute URL' })
  }
  if (parsed.protocol !== 'https:') {
    throw new WebhookManagerException({ kind: 'invalid_url', message: 'url must use HTTPS' })
  }
  if (!parsed.hostname) {
    throw new WebhookManagerException({ kind: 'invalid_url', message: 'url must have a hostname' })
  }
  if (parsed.hash) {
    throw new WebhookManagerException({ kind: 'invalid_url', message: 'url must not contain a fragment' })
  }
  return parsed
}

export function normalizeUrl(url: URL): string {
  const scheme = url.protocol.toLowerCase()
  const host = url.hostname.toLowerCase()
  // drop default HTTPS port
  const port = url.port && url.port !== '443' ? `:${url.port}` : ''
  let path = url.pathname
  // strip trailing slash from otherwise-empty path
  if (path === '/') path = ''
  const query = url.search
  return `${scheme}//${host}${port}${path}${query}`
}
