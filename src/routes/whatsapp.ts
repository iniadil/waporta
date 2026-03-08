import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import wa from '../wa.js'
import { setPendingSession, getQR } from '../events.js'

const app = new OpenAPIHono()

const SessionIdParam = z.object({
  sessionId: z.string().openapi({ example: 'my-session' }),
})

const StatusResponse = z.object({ status: z.string() })
const ErrorResponse = z.object({ error: z.string() })

// List all sessions
app.openapi(
  createRoute({
    method: 'get',
    path: '/sessions',
    tags: ['Sessions'],
    summary: 'List all sessions',
    responses: {
      200: {
        description: 'List of session IDs',
        content: {
          'application/json': {
            schema: z.object({ sessions: z.array(z.string()) }),
          },
        },
      },
    },
  }),
  async (c) => {
    const sessions = await wa.getSessionsIds()
    return c.json({ sessions })
  }
)

// Start a new session
app.openapi(
  createRoute({
    method: 'post',
    path: '/sessions/{sessionId}',
    tags: ['Sessions'],
    summary: 'Start a new session',
    request: { params: SessionIdParam },
    responses: {
      200: {
        description: 'Session starting',
        content: {
          'application/json': {
            schema: z.object({ status: z.string(), sessionId: z.string() }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { sessionId } = c.req.valid('param')
    setPendingSession(sessionId)
    await wa.startSession(sessionId)
    return c.json({ status: 'starting', sessionId })
  }
)

// Get QR code for a session
app.openapi(
  createRoute({
    method: 'get',
    path: '/sessions/{sessionId}/qr',
    tags: ['Sessions'],
    summary: 'Get QR code for a session',
    request: { params: SessionIdParam },
    responses: {
      200: {
        description: 'QR code data',
        content: {
          'application/json': {
            schema: z.object({ qr: z.string().nullable() }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { sessionId } = c.req.valid('param')
    const qr = getQR(sessionId)
    return c.json({ qr })
  }
)

// Start a new session with pairing code
app.openapi(
  createRoute({
    method: 'post',
    path: '/sessions/{sessionId}/pairing-code',
    tags: ['Sessions'],
    summary: 'Start a session with pairing code',
    request: {
      params: SessionIdParam,
      body: {
        required: true,
        content: {
          'application/json': {
            schema: z.object({
              phoneNumber: z.string().openapi({ example: '6281234567890' }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Pairing code generated',
        content: {
          'application/json': {
            schema: z.object({
              status: z.string(),
              sessionId: z.string(),
              pairingCode: z.string(),
            }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { sessionId } = c.req.valid('param')
    const { phoneNumber } = c.req.valid('json')

    const pairingCode = await new Promise<string>((resolve, reject) => {
      wa.startSessionWithPairingCode(sessionId, {
        phoneNumber,
        onPairingCode: (code) => resolve(code),
      }).catch(reject)
    })

    return c.json({ status: 'waiting_for_confirmation', sessionId, pairingCode })
  }
)

// Delete a session
app.openapi(
  createRoute({
    method: 'delete',
    path: '/sessions/{sessionId}',
    tags: ['Sessions'],
    summary: 'Delete a session',
    request: { params: SessionIdParam },
    responses: {
      200: {
        description: 'Session deleted',
        content: {
          'application/json': {
            schema: z.object({ status: z.string(), sessionId: z.string() }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { sessionId } = c.req.valid('param')
    await wa.deleteSession(sessionId)
    return c.json({ status: 'deleted', sessionId })
  }
)

// Get session status
app.openapi(
  createRoute({
    method: 'get',
    path: '/sessions/{sessionId}',
    tags: ['Sessions'],
    summary: 'Get session status',
    request: { params: SessionIdParam },
    responses: {
      200: {
        description: 'Session info',
        content: {
          'application/json': {
            schema: z.object({
              sessionId: z.string(),
              session: z.record(z.string(), z.unknown()),
            }),
          },
        },
      },
      404: {
        description: 'Session not found',
        content: { 'application/json': { schema: ErrorResponse } },
      },
    },
  }),
  async (c) => {
    const { sessionId } = c.req.valid('param')
    const session = await wa.getSessionById(sessionId)
    if (!session) return c.json({ error: 'Session not found' }, 404 as const)
    return c.json({ sessionId, session: session as Record<string, unknown> }, 200 as const)
  }
)

// Send text message
app.openapi(
  createRoute({
    method: 'post',
    path: '/send/text',
    tags: ['Messaging'],
    summary: 'Send a text message',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: z.object({
              sessionId: z.string().openapi({ example: 'my-session' }),
              to: z.string().openapi({ example: '6281234567890' }),
              text: z.string().openapi({ example: 'Hello!' }),
              isGroup: z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Message sent',
        content: { 'application/json': { schema: StatusResponse } },
      },
    },
  }),
  async (c) => {
    const { sessionId, to, text, isGroup } = c.req.valid('json')
    await wa.sendText({ sessionId, to, text, isGroup })
    return c.json({ status: 'sent' })
  }
)

// Send image
app.openapi(
  createRoute({
    method: 'post',
    path: '/send/image',
    tags: ['Messaging'],
    summary: 'Send an image',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: z.object({
              sessionId: z.string().openapi({ example: 'my-session' }),
              to: z.string().openapi({ example: '6281234567890' }),
              media: z.string().openapi({ description: 'URL or base64 of image' }),
              text: z.string().optional(),
              isGroup: z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Image sent',
        content: { 'application/json': { schema: StatusResponse } },
      },
    },
  }),
  async (c) => {
    const { sessionId, to, media, text, isGroup } = c.req.valid('json')
    await wa.sendImage({ sessionId, to, media, text, isGroup })
    return c.json({ status: 'sent' })
  }
)

// Send document
app.openapi(
  createRoute({
    method: 'post',
    path: '/send/document',
    tags: ['Messaging'],
    summary: 'Send a document',
    request: {
      body: {
        required: true,
        content: {
          'application/json': {
            schema: z.object({
              sessionId: z.string().openapi({ example: 'my-session' }),
              to: z.string().openapi({ example: '6281234567890' }),
              media: z.string().openapi({ description: 'URL or base64 of document' }),
              filename: z.string().openapi({ example: 'document.pdf' }),
              text: z.string().optional(),
              isGroup: z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: 'Document sent',
        content: { 'application/json': { schema: StatusResponse } },
      },
    },
  }),
  async (c) => {
    const { sessionId, to, media, filename, text, isGroup } = c.req.valid('json')
    await wa.sendDocument({ sessionId, to, media, filename, text, isGroup })
    return c.json({ status: 'sent' })
  }
)

// Check if number exists
app.openapi(
  createRoute({
    method: 'get',
    path: '/check',
    tags: ['Messaging'],
    summary: 'Check if a number exists on WhatsApp',
    request: {
      query: z.object({
        sessionId: z.string().openapi({ example: 'my-session' }),
        to: z.string().openapi({ example: '6281234567890' }),
        isGroup: z.string().optional().openapi({ example: 'false' }),
      }),
    },
    responses: {
      200: {
        description: 'Check result',
        content: {
          'application/json': {
            schema: z.object({ exists: z.boolean() }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { sessionId, to, isGroup } = c.req.valid('query')
    const exists = await wa.isExist({ sessionId, to, isGroup: isGroup === 'true' })
    return c.json({ exists })
  }
)

export default app
