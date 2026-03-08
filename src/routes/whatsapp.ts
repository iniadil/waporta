import { Hono } from "hono";
import wa from "../wa.js";

const app = new Hono();

// List all sessions
app.get("/sessions", async (c) => {
  const sessions = await wa.getSessionsIds();
  return c.json({ sessions });
});

// Start a new session
app.post("/sessions/:sessionId", async (c) => {
  const { sessionId } = c.req.param();
  await wa.startSession(sessionId);
  return c.json({ status: "starting", sessionId });
});

// Start a new session with pairing code
app.post("/sessions/:sessionId/pairing-code", async (c) => {
  const { sessionId } = c.req.param();
  const body = await c.req.json();
  const { phoneNumber } = body;

  if (!phoneNumber) {
    return c.json({ error: "phoneNumber is required" }, 400);
  }

  const pairingCode = await new Promise<string>((resolve, reject) => {
    wa.startSessionWithPairingCode(sessionId, {
      phoneNumber,
      onPairingCode: (code) => resolve(code),
    }).catch(reject);
  });

  return c.json({ status: "waiting_for_confirmation", sessionId, pairingCode });
});

// Delete a session
app.delete("/sessions/:sessionId", async (c) => {
  const { sessionId } = c.req.param();
  await wa.deleteSession(sessionId);
  return c.json({ status: "deleted", sessionId });
});

// Get session status
app.get("/sessions/:sessionId", async (c) => {
  const { sessionId } = c.req.param();
  const session = await wa.getSessionById(sessionId);
  if (!session) return c.json({ error: "Session not found" }, 404);
  return c.json({ sessionId, session });
});

// Send text message
app.post("/send/text", async (c) => {
  const body = await c.req.json();
  const { sessionId, to, text, isGroup } = body;

  if (!sessionId || !to || !text) {
    return c.json({ error: "sessionId, to, and text are required" }, 400);
  }

  await wa.sendText({ sessionId, to, text, isGroup });
  return c.json({ status: "sent" });
});

// Send image
app.post("/send/image", async (c) => {
  const body = await c.req.json();
  const { sessionId, to, media, text, isGroup } = body;

  if (!sessionId || !to || !media) {
    return c.json({ error: "sessionId, to, and media are required" }, 400);
  }

  await wa.sendImage({ sessionId, to, media, text, isGroup });
  return c.json({ status: "sent" });
});

// Send document
app.post("/send/document", async (c) => {
  const body = await c.req.json();
  const { sessionId, to, media, filename, text, isGroup } = body;

  if (!sessionId || !to || !media || !filename) {
    return c.json(
      { error: "sessionId, to, media, and filename are required" },
      400,
    );
  }

  await wa.sendDocument({ sessionId, to, media, filename, text, isGroup });
  return c.json({ status: "sent" });
});

// Check if number exists
app.get("/check", async (c) => {
  const { sessionId, to, isGroup } = c.req.query();

  if (!sessionId || !to) {
    return c.json({ error: "sessionId and to are required" }, 400);
  }

  const exists = await wa.isExist({
    sessionId,
    to,
    isGroup: isGroup === "true",
  });
  return c.json({ exists });
});

export default app;
