import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import whatsappRoutes from './routes/whatsapp.js'

const app = new Hono()

app.use('*', logger())
app.use('*', prettyJSON())

app.get('/', (c) => c.json({ status: 'ok', message: 'WA Gateway API' }))

app.route('/api/whatsapp', whatsappRoutes)

app.notFound((c) => c.json({ error: 'Not Found' }, 404))
app.onError((err, c) => {
  console.error(err)
  if (err instanceof SyntaxError || err.message.includes('JSON')) {
    return c.json({ error: 'Invalid or missing JSON body' }, 400)
  }
  return c.json({ error: err.message }, 500)
})

export default app
