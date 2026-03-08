import { serve } from '@hono/node-server'
import app from './src/index.js'

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000

serve({ fetch: app.fetch, port }, () => {
  console.log(`Server running on http://localhost:${port}`)
})
