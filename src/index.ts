import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'
import whatsappRoutes from './routes/whatsapp.js'

const app = new OpenAPIHono()

app.use('*', logger())
app.use('*', prettyJSON())
app.use('/api/*', cors({ origin: 'http://localhost:5173' }))

app.get('/', (c) => c.json({ status: 'ok', message: 'WA Gateway API' }))

app.route('/api/whatsapp', whatsappRoutes)

export const openAPIConfig = {
  openapi: '3.0.0' as const,
  info: {
    title: 'WA Gateway API',
    version: '1.0.0',
    description: 'WhatsApp Gateway REST API powered by Baileys',
  },
}

app.doc('/openapi.json', openAPIConfig)
app.get('/doc', swaggerUI({ url: '/openapi.json' }))

app.get('/dashboard', (c) => c.redirect('/dashboard/'))
app.use('/dashboard/*', serveStatic({ root: './dashboard/dist', rewriteRequestPath: (p) => p.replace('/dashboard', '') }))

app.notFound((c) => c.json({ error: 'Not Found' }, 404))
app.onError((err, c) => {
  console.error(err)
  if (err instanceof SyntaxError || err.message.includes('JSON')) {
    return c.json({ error: 'Invalid or missing JSON body' }, 400)
  }
  return c.json({ error: err.message }, 500)
})

export default app
