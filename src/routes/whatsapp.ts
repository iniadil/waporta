import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import wa from "../wa.js";
import { setPendingSession, getQR } from "../events.js";
import {
  sendWithRetry,
  RetriesExhaustedError,
} from "../lib/send-with-retry.js";
import { assertCanSend } from "../lib/send-guard.js";
import * as messageState from "../lib/message-state.js";
import * as messageLog from "../lib/message-log.js";

const app = new OpenAPIHono();

const SessionIdParam = z.object({
  sessionId: z.string().openapi({ example: "my-session" }),
});

const StatusResponse = z.object({
  status: z.string().openapi({
    example: "sent",
    description:
      '"sent" berarti pesan berhasil ditulis ke koneksi WhatsApp — bukan konfirmasi bahwa pesan sudah diterima server atau sampai ke penerima. Pantau status sebenarnya lewat GET /messages/{messageId} atau webhook "message.status".',
  }),
  messageId: z.string().optional().openapi({
    example: "3EB0A1B2C3D4E5F6",
    description:
      "ID pesan WhatsApp. Dipakai untuk melacak status pengiriman. Tidak ada bila WhatsApp tidak mengembalikan ID.",
  }),
  ack: z.literal("socket").optional().openapi({
    description:
      "Tingkat konfirmasi yang sudah dicapai saat respons ini dibuat. Selalu \"socket\" — tingkat di atasnya (server/delivered/read) datang belakangan secara asinkron.",
  }),
});
const ErrorResponse = z.object({ error: z.string() });
const DeliveryFailedResponse = z.object({
  error: z.literal("delivery_failed"),
  message: z.string(),
  attempts: z.number(),
});
// Penolakan oleh anti-ban guard / sesi belum siap (403 / 422 / 429 / 503).
const GuardRejectionResponse = z.object({
  error: z.string(),
  message: z.string(),
  retryAfterMs: z.number().optional(),
});

/**
 * Ambil ID pesan dari hasil kirim Baileys lalu catat supaya event status yang
 * datang belakangan bisa dikaitkan kembali ke permintaan HTTP ini.
 */
function trackSent(
  sent: unknown,
  meta: { sessionId: string; to: string; messageType: "text" | "image" | "document" },
): string | undefined {
  const messageId = (sent as { key?: { id?: string } } | undefined)?.key?.id;
  if (messageId) messageState.record({ ...meta, messageId });
  messageLog.append({
    event: "message.out",
    sessionId: meta.sessionId,
    messageId,
    peer: meta.to,
    messageType: meta.messageType,
    status: "socket",
  });
  return messageId;
}

// Dipakai oleh ketiga endpoint kirim.
const SEND_RESPONSES = {
  403: {
    description: "Session was rejected by WhatsApp (number appears to be blocked)",
    content: { "application/json": { schema: GuardRejectionResponse } },
  },
  422: {
    description: "Recipient is not registered on WhatsApp",
    content: { "application/json": { schema: GuardRejectionResponse } },
  },
  429: {
    description:
      'Rejected by an anti-ban guard. The "error" field distinguishes them: "session_warming_up" (retry after the warm-up window), "rate_limited" (short sliding window), or "daily_quota_exceeded" (a new session\'s ramp-up quota, which only resets at midnight — note the much larger retryAfterMs).',
    content: { "application/json": { schema: GuardRejectionResponse } },
  },
  502: {
    description: "Delivery failed after retries",
    content: { "application/json": { schema: DeliveryFailedResponse } },
  },
  503: {
    description: "Session is not ready (e.g. reconnecting)",
    content: { "application/json": { schema: GuardRejectionResponse } },
  },
};

// List all sessions
app.openapi(
  createRoute({
    method: "get",
    path: "/sessions",
    tags: ["Sessions"],
    summary: "List all sessions",
    responses: {
      200: {
        description: "List of session IDs",
        content: {
          "application/json": {
            schema: z.object({ sessions: z.array(z.string()) }),
          },
        },
      },
    },
  }),
  async (c) => {
    const sessions = await wa.getSessionsIds();
    return c.json({ sessions });
  },
);

// Start a new session
app.openapi(
  createRoute({
    method: "post",
    path: "/sessions/{sessionId}",
    tags: ["Sessions"],
    summary: "Start a new session",
    request: { params: SessionIdParam },
    responses: {
      200: {
        description: "Session starting",
        content: {
          "application/json": {
            schema: z.object({ status: z.string(), sessionId: z.string() }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { sessionId } = c.req.valid("param");
    setPendingSession(sessionId);
    await wa.startSession(sessionId);
    return c.json({ status: "starting", sessionId });
  },
);

// Get QR code for a session
app.openapi(
  createRoute({
    method: "get",
    path: "/sessions/{sessionId}/qr",
    tags: ["Sessions"],
    summary: "Get QR code for a session",
    request: { params: SessionIdParam },
    responses: {
      200: {
        description: "QR code data",
        content: {
          "application/json": {
            schema: z.object({ qr: z.string().nullable() }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { sessionId } = c.req.valid("param");
    const qr = getQR(sessionId);
    return c.json({ qr });
  },
);

// Start a new session with pairing code
app.openapi(
  createRoute({
    method: "post",
    path: "/sessions/{sessionId}/pairing-code",
    tags: ["Sessions"],
    summary: "Start a session with pairing code",
    request: {
      params: SessionIdParam,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              phoneNumber: z.string().openapi({ example: "6281234567890" }),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Pairing code generated",
        content: {
          "application/json": {
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
    const { sessionId } = c.req.valid("param");
    const { phoneNumber } = c.req.valid("json");

    const pairingCode = await new Promise<string>((resolve, reject) => {
      wa.startSessionWithPairingCode(sessionId, {
        phoneNumber,
        onPairingCode: (code) => resolve(code),
      }).catch(reject);
    });

    return c.json({
      status: "waiting_for_confirmation",
      sessionId,
      pairingCode,
    });
  },
);

// Delete a session
app.openapi(
  createRoute({
    method: "delete",
    path: "/sessions/{sessionId}",
    tags: ["Sessions"],
    summary: "Delete a session",
    request: { params: SessionIdParam },
    responses: {
      200: {
        description: "Session deleted",
        content: {
          "application/json": {
            schema: z.object({ status: z.string(), sessionId: z.string() }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { sessionId } = c.req.valid("param");
    await wa.deleteSession(sessionId);
    return c.json({ status: "deleted", sessionId });
  },
);

// Get session status
app.openapi(
  createRoute({
    method: "get",
    path: "/sessions/{sessionId}",
    tags: ["Sessions"],
    summary: "Get session status",
    request: { params: SessionIdParam },
    responses: {
      200: {
        description: "Session info",
        content: {
          "application/json": {
            schema: z.object({
              sessionId: z.string(),
              status: z.enum(["connecting", "connected", "disconnected"]),
              user: z
                .object({
                  id: z.string(),
                  name: z.string().optional(),
                  lid: z.string().optional(),
                })
                .nullable(),
            }),
          },
        },
      },
      404: {
        description: "Session not found",
        content: { "application/json": { schema: ErrorResponse } },
      },
    },
  }),
  async (c) => {
    const { sessionId } = c.req.valid("param");
    const session = await wa.getSessionById(sessionId);
    if (!session) return c.json({ error: "Session not found" }, 404 as const);
    const sockUser = session.sock.user;
    const user = sockUser
      ? { id: sockUser.id, name: sockUser.name, lid: sockUser.lid }
      : null;
    return c.json({ sessionId, status: session.status, user }, 200 as const);
  },
);

// Send text message
app.openapi(
  createRoute({
    method: "post",
    path: "/send/text",
    tags: ["Messaging"],
    summary: "Send a text message",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              sessionId: z.string().openapi({ example: "my-session" }),
              to: z.string().openapi({ example: "6281234567890" }),
              text: z.string().openapi({ example: "Hello!" }),
              isGroup: z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Message written to the WhatsApp connection",
        content: { "application/json": { schema: StatusResponse } },
      },
      ...SEND_RESPONSES,
    },
  }),
  async (c) => {
    const { sessionId, to, text, isGroup } = c.req.valid("json");
    await assertCanSend({ sessionId, to, isGroup });
    try {
      const sent = await sendWithRetry({
        sessionId,
        to,
        isGroup,
        messageType: "text",
        sendFn: () => wa.sendText({ sessionId, to, text, isGroup }),
      });
      const messageId = trackSent(sent, { sessionId, to, messageType: "text" });
      return c.json({ status: "sent", messageId, ack: "socket" as const }, 200 as const);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const attempts = err instanceof RetriesExhaustedError ? err.attempts : 1;
      return c.json(
        { error: "delivery_failed" as const, message: msg, attempts },
        502 as const,
      );
    }
  },
);

// Send image
app.openapi(
  createRoute({
    method: "post",
    path: "/send/image",
    tags: ["Messaging"],
    summary: "Send an image",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              sessionId: z.string().openapi({ example: "my-session" }),
              to: z.string().openapi({ example: "6281234567890" }),
              media: z
                .string()
                .openapi({ description: "URL or base64 of image" }),
              text: z.string().optional(),
              isGroup: z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Image written to the WhatsApp connection",
        content: { "application/json": { schema: StatusResponse } },
      },
      ...SEND_RESPONSES,
    },
  }),
  async (c) => {
    const { sessionId, to, media, text, isGroup } = c.req.valid("json");
    await assertCanSend({ sessionId, to, isGroup });
    try {
      const sent = await sendWithRetry({
        sessionId,
        to,
        isGroup,
        messageType: "image",
        sendFn: () => wa.sendImage({ sessionId, to, media, text, isGroup }),
      });
      const messageId = trackSent(sent, { sessionId, to, messageType: "image" });
      return c.json({ status: "sent", messageId, ack: "socket" as const }, 200 as const);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const attempts = err instanceof RetriesExhaustedError ? err.attempts : 1;
      return c.json(
        { error: "delivery_failed" as const, message: msg, attempts },
        502 as const,
      );
    }
  },
);

// Send document
app.openapi(
  createRoute({
    method: "post",
    path: "/send/document",
    tags: ["Messaging"],
    summary: "Send a document",
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: z.object({
              sessionId: z.string().openapi({ example: "my-session" }),
              to: z.string().openapi({ example: "6281234567890" }),
              media: z
                .string()
                .openapi({ description: "URL or base64 of document" }),
              filename: z.string().openapi({ example: "document.pdf" }),
              text: z.string().optional(),
              isGroup: z.boolean().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Document written to the WhatsApp connection",
        content: { "application/json": { schema: StatusResponse } },
      },
      ...SEND_RESPONSES,
    },
  }),
  async (c) => {
    const { sessionId, to, media, filename, text, isGroup } =
      c.req.valid("json");
    await assertCanSend({ sessionId, to, isGroup });
    try {
      const sent = await sendWithRetry({
        sessionId,
        to,
        isGroup,
        messageType: "document",
        sendFn: () =>
          wa.sendDocument({ sessionId, to, media, filename, text, isGroup }),
      });
      const messageId = trackSent(sent, { sessionId, to, messageType: "document" });
      return c.json({ status: "sent", messageId, ack: "socket" as const }, 200 as const);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const attempts = err instanceof RetriesExhaustedError ? err.attempts : 1;
      return c.json(
        { error: "delivery_failed" as const, message: msg, attempts },
        502 as const,
      );
    }
  },
);

// Get delivery status of a sent message
app.openapi(
  createRoute({
    method: "get",
    path: "/messages/{messageId}",
    tags: ["Messaging"],
    summary: "Get delivery status of a sent message",
    description:
      'Status sebenarnya dari pesan yang dikirim lewat gateway ini, diperbarui dari event WhatsApp. Urutan normal: socket -> pending -> server -> delivered -> read. Status bertahan di "socket" berarti WhatsApp tidak pernah mengonfirmasi apa pun. Data disimpan in-memory, jadi hilang saat proses restart dan hanya mencakup MESSAGE_STATE_MAX pesan terakhir.',
    request: {
      params: z.object({
        messageId: z.string().openapi({ example: "3EB0A1B2C3D4E5F6" }),
      }),
    },
    responses: {
      200: {
        description: "Current delivery status",
        content: {
          "application/json": {
            schema: z.object({
              messageId: z.string(),
              sessionId: z.string(),
              to: z.string(),
              messageType: z.enum(["text", "image", "document"]),
              status: z.enum([
                "socket",
                "pending",
                "server",
                "delivered",
                "read",
                "played",
                "error",
              ]),
              createdAt: z.number(),
              updatedAt: z.number(),
            }),
          },
        },
      },
      404: {
        description: "Message is unknown or its record has expired",
        content: { "application/json": { schema: ErrorResponse } },
      },
      409: {
        description: "Message tracking is disabled (MESSAGE_STATE_MAX=0)",
        content: { "application/json": { schema: ErrorResponse } },
      },
    },
  }),
  async (c) => {
    const { messageId } = c.req.valid("param");
    if (!messageState.isEnabled()) {
      return c.json({ error: "message_state_disabled" }, 409 as const);
    }
    const found = messageState.get(messageId);
    if (!found) return c.json({ error: "message_not_found" }, 404 as const);
    return c.json(found, 200 as const);
  },
);

// Check if number exists
app.openapi(
  createRoute({
    method: "get",
    path: "/check",
    tags: ["Messaging"],
    summary: "Check if a number exists on WhatsApp",
    request: {
      query: z.object({
        sessionId: z.string().openapi({ example: "my-session" }),
        to: z.string().openapi({ example: "6281234567890" }),
        isGroup: z.string().optional().openapi({ example: "false" }),
      }),
    },
    responses: {
      200: {
        description: "Check result",
        content: {
          "application/json": {
            schema: z.object({ exists: z.boolean() }),
          },
        },
      },
    },
  }),
  async (c) => {
    const { sessionId, to, isGroup } = c.req.valid("query");
    const exists = await wa.isExist({
      sessionId,
      to,
      isGroup: isGroup === "true",
    });
    return c.json({ exists });
  },
);

export default app;
