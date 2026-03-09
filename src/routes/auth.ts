import { Hono } from 'hono'
import { randomBytes } from 'crypto'
import { tokenStore, authMiddleware } from '../middleware/auth.js'

const app = new Hono()

app.post('/login', async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>()

  const expectedUser = process.env.DASHBOARD_USERNAME ?? 'admin'
  const expectedPass = process.env.DASHBOARD_PASSWORD ?? 'changeme'

  if (username !== expectedUser || password !== expectedPass) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const token = randomBytes(32).toString('hex')
  tokenStore.add(token)
  return c.json({ token })
})

app.post('/logout', authMiddleware, async (c) => {
  const auth = c.req.header('Authorization')!
  tokenStore.delete(auth.slice(7))
  return c.json({ ok: true })
})

app.get('/check', authMiddleware, (c) => c.json({ ok: true }))

export default app
