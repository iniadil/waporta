import { Hono } from 'hono'
import { listKeys, createKey, deleteKey } from '../apikeys.js'

const app = new Hono()

app.get('/', (c) => c.json(listKeys()))

app.post('/', async (c) => {
  const { name } = await c.req.json<{ name: string }>()
  if (!name?.trim()) return c.json({ error: 'Name is required' }, 400)
  const key = createKey(name.trim())
  return c.json(key, 201)
})

app.delete('/:id', (c) => {
  const { id } = c.req.param()
  const ok = deleteKey(id)
  if (!ok) return c.json({ error: 'Not found' }, 404)
  return c.json({ ok: true })
})

export default app
