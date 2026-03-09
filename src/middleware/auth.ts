import type { Context, Next } from 'hono'
import { validateKey } from '../apikeys.js'

export const tokenStore = new Set<string>()

export async function authMiddleware(c: Context, next: Next) {
  const auth = c.req.header('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  const token = auth.slice(7)
  if (!tokenStore.has(token)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
}

export async function apiKeyMiddleware(c: Context, next: Next) {
  const key = c.req.header('X-API-Key')
  if (!key || !validateKey(key)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
}

export async function dualAuthMiddleware(c: Context, next: Next) {
  const auth = c.req.header('Authorization')
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7)
    if (tokenStore.has(token)) {
      await next()
      return
    }
  }

  const key = c.req.header('X-API-Key')
  if (key && validateKey(key)) {
    await next()
    return
  }

  return c.json({ error: 'Unauthorized' }, 401)
}
