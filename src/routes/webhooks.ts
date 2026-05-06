import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { WebhookUrlManager } from '../webhooks/manager.js'
import { WebhookManagerException } from '../webhooks/types.js'

const SessionIdParam = z.object({
  sessionId: z
    .string()
    .min(1)
    .max(128)
    .openapi({ param: { name: 'sessionId', in: 'path' }, example: 'my-session' }),
})

const WebhookIdParam = z.object({
  sessionId: z
    .string()
    .min(1)
    .max(128)
    .openapi({ param: { name: 'sessionId', in: 'path' }, example: 'my-session' }),
  id: z
    .string()
    .openapi({ param: { name: 'id', in: 'path' }, example: 'a1b2c3d4e5f6a7b8' }),
})

const WebhookUrlRecordSchema = z
  .object({
    id: z.string().openapi({ example: 'a1b2c3d4e5f6a7b8' }),
    sessionId: z.string().openapi({ example: 'my-session' }),
    url: z.string().openapi({ example: 'https://example.com/whatsapp' }),
    normalizedUrl: z.string().openapi({ example: 'https://example.com/whatsapp' }),
    enabled: z.boolean().openapi({ example: true }),
    createdAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
    updatedAt: z.string().openapi({ example: '2024-01-01T00:00:00.000Z' }),
  })
  .openapi('WebhookUrlRecord')

const CreateWebhookUrlRequestSchema = z
  .object({
    url: z
      .string()
      .openapi({ example: 'https://example.com/whatsapp', description: 'Absolute HTTPS URL, max 2048 characters, no fragment' }),
  })
  .openapi('CreateWebhookUrlRequest')

const DeleteWebhookUrlResponseSchema = z
  .object({
    id: z.string().openapi({ example: 'a1b2c3d4e5f6a7b8' }),
    sessionId: z.string().openapi({ example: 'my-session' }),
  })
  .openapi('DeleteWebhookUrlResponse')

const ValidationErrorSchema = z
  .object({ error: z.string().openapi({ example: 'Invalid webhook URL' }) })
  .openapi('ValidationError')

const DuplicateWebhookUrlErrorSchema = z
  .object({
    error: z.literal('duplicate_webhook_url').openapi({ example: 'duplicate_webhook_url' }),
    existingId: z.string().openapi({ example: 'a1b2c3d4e5f6a7b8' }),
  })
  .openapi('DuplicateWebhookUrlError')

// Outbound payload schema — documented as component, not used as route request/response
const WebhookMessagePayloadSchema = z
  .object({
    event: z.literal('message.received').openapi({ example: 'message.received' }),
    sessionId: z.string().openapi({ example: 'my-session' }),
    messageId: z.string().optional().openapi({ example: 'ABCDEF123456' }),
    sender: z.string().optional().openapi({ example: '6281234567890@s.whatsapp.net' }),
    recipient: z.string().optional().openapi({ example: '6289876543210@s.whatsapp.net' }),
    timestamp: z.union([z.number(), z.string()]).optional().openapi({ example: 1700000000 }),
    messageType: z.string().optional().openapi({ example: 'text' }),
    content: z.unknown().optional(),
    raw: z.unknown(),
  })
  .openapi('WebhookMessagePayload')

const OperationalErrorSchema = z.object({ error: z.string() })

const SECURITY: Array<Record<string, string[]>> = [{ Bearer: [] }, { ApiKeyAuth: [] }]

function mapError(
  c: Parameters<Parameters<OpenAPIHono['openapi']>[1]>[0],
  err: unknown,
): Response {
  if (err instanceof WebhookManagerException) {
    const d = err.detail
    if (d.kind === 'invalid_session' || d.kind === 'invalid_url') {
      return c.json({ error: d.message }, 400)
    }
    if (d.kind === 'duplicate') {
      return c.json({ error: 'duplicate_webhook_url', existingId: d.existingId }, 409)
    }
    if (d.kind === 'not_found') {
      return c.json({ error: 'Not Found' }, 404)
    }
    if (d.kind === 'store_unavailable') {
      return c.json({ error: 'Webhook URL store unavailable' }, 500)
    }
  }
  console.error('[webhook-route] unexpected error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
}

export function createWebhookRoutes(manager: WebhookUrlManager): OpenAPIHono {
  const app = new OpenAPIHono()

  // Force WebhookMessagePayload schema into the OpenAPI components
  app.openAPIRegistry.registerComponent('schemas', 'WebhookMessagePayload', {
    type: 'object',
    description:
      'JSON body POSTed to each registered webhook URL when an incoming WhatsApp message is received. Fields are sourced from the wa-multi-session event for the session.',
    required: ['event', 'sessionId', 'raw'],
    properties: {
      event: { type: 'string', enum: ['message.received'], example: 'message.received' },
      sessionId: { type: 'string', example: 'my-session' },
      messageId: { type: 'string', example: 'ABCDEF123456' },
      sender: { type: 'string', example: '6281234567890@s.whatsapp.net' },
      recipient: { type: 'string', example: '6289876543210@s.whatsapp.net' },
      timestamp: { oneOf: [{ type: 'number' }, { type: 'string' }], example: 1700000000 },
      messageType: { type: 'string', example: 'text' },
      content: { description: 'Message content metadata (authentication secrets redacted)' },
      raw: { description: 'Full raw wa-multi-session event (authentication secrets redacted)' },
    },
  })

  // POST /sessions/{sessionId}/webhooks — Add a webhook URL
  app.openapi(
    createRoute({
      method: 'post',
      path: '/sessions/{sessionId}/webhooks',
      tags: ['Webhooks'],
      summary: 'Add a webhook URL for a session',
      description:
        'Register an HTTPS webhook URL to receive realtime incoming WhatsApp message events for the specified session. Multiple webhook URLs may be registered per session. Each registered URL will receive a POST request with a WebhookMessagePayload body when a message arrives.',
      security: SECURITY,
      request: {
        params: SessionIdParam,
        body: {
          content: { 'application/json': { schema: CreateWebhookUrlRequestSchema } },
          required: true,
        },
      },
      responses: {
        201: {
          description: 'Webhook URL created',
          content: { 'application/json': { schema: WebhookUrlRecordSchema } },
        },
        400: {
          description: 'Invalid sessionId or webhook URL',
          content: { 'application/json': { schema: ValidationErrorSchema } },
        },
        401: { description: 'Unauthorized' },
        409: {
          description: 'Duplicate webhook URL for this session',
          content: { 'application/json': { schema: DuplicateWebhookUrlErrorSchema } },
        },
        500: {
          description: 'Webhook URL store unavailable',
          content: { 'application/json': { schema: OperationalErrorSchema } },
        },
      },
    }),
    async (c) => {
      if (!manager.isOperational()) {
        return c.json({ error: 'Webhook URL store unavailable' }, 500)
      }
      const { sessionId } = c.req.valid('param')
      const { url } = c.req.valid('json')
      try {
        const record = await manager.create(sessionId, { url })
        return c.json(record, 201)
      } catch (err) {
        return mapError(c, err)
      }
    },
  )

  // GET /sessions/{sessionId}/webhooks — List webhook URLs
  app.openapi(
    createRoute({
      method: 'get',
      path: '/sessions/{sessionId}/webhooks',
      tags: ['Webhooks'],
      summary: 'List webhook URLs for a session',
      description: 'Returns all webhook URL records for the specified session sorted by creation time ascending. No authentication secrets or WhatsApp credentials are included in the response.',
      security: SECURITY,
      request: { params: SessionIdParam },
      responses: {
        200: {
          description: 'Webhook URL records sorted by createdAt ascending',
          content: { 'application/json': { schema: z.array(WebhookUrlRecordSchema) } },
        },
        400: {
          description: 'Invalid sessionId',
          content: { 'application/json': { schema: ValidationErrorSchema } },
        },
        401: { description: 'Unauthorized' },
        500: {
          description: 'Webhook URL store unavailable',
          content: { 'application/json': { schema: OperationalErrorSchema } },
        },
      },
    }),
    async (c) => {
      if (!manager.isOperational()) {
        return c.json({ error: 'Webhook URL store unavailable' }, 500)
      }
      const { sessionId } = c.req.valid('param')
      try {
        const records = await manager.list(sessionId)
        return c.json(records, 200)
      } catch (err) {
        return mapError(c, err)
      }
    },
  )

  // DELETE /sessions/{sessionId}/webhooks/{id} — Delete a webhook URL
  app.openapi(
    createRoute({
      method: 'delete',
      path: '/sessions/{sessionId}/webhooks/{id}',
      tags: ['Webhooks'],
      summary: 'Delete a webhook URL',
      description: 'Removes a webhook URL record by its id. The sessionId in the path must match the record\'s session; records from other sessions return 404.',
      security: SECURITY,
      request: { params: WebhookIdParam },
      responses: {
        200: {
          description: 'Webhook URL deleted',
          content: { 'application/json': { schema: DeleteWebhookUrlResponseSchema } },
        },
        400: {
          description: 'Invalid sessionId',
          content: { 'application/json': { schema: ValidationErrorSchema } },
        },
        401: { description: 'Unauthorized' },
        404: {
          description: 'Webhook URL not found or session mismatch',
          content: { 'application/json': { schema: ValidationErrorSchema } },
        },
        500: {
          description: 'Webhook URL store unavailable',
          content: { 'application/json': { schema: OperationalErrorSchema } },
        },
      },
    }),
    async (c) => {
      if (!manager.isOperational()) {
        return c.json({ error: 'Webhook URL store unavailable' }, 500)
      }
      const { sessionId, id } = c.req.valid('param')
      try {
        const result = await manager.delete(sessionId, id)
        return c.json(result, 200)
      } catch (err) {
        return mapError(c, err)
      }
    },
  )

  return app
}
