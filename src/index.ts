import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { createRequire } from "module";
import whatsappRoutes from "./routes/whatsapp.js";
import authRoutes from "./routes/auth.js";
import apiKeysRoutes from "./routes/apikeys.js";
import { authMiddleware, dualAuthMiddleware } from "./middleware/auth.js";
import { webhookManager } from "./webhooks/singletons.js";
import { createWebhookRoutes } from "./routes/webhooks.js";
import { WhatsappError } from "wa-multi-session";
import {
  RecipientNotFoundError,
  SessionWarmingUpError,
  RateLimitExceededError,
} from "./lib/session-guard.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const app = new OpenAPIHono();

app.use("*", logger());
app.use("*", prettyJSON());
app.use("/api/*", cors({ origin: "http://localhost:5173" }));
app.use("/auth/*", cors({ origin: "http://localhost:5173" }));

app.get("/", (c) => c.json({ status: "ok", message: "WA Porta API" }));

app.route("/auth", authRoutes);

app.use("/api/keys*", authMiddleware);
app.route("/api/keys", apiKeysRoutes);

app.use("/api/whatsapp/*", dualAuthMiddleware);
app.route("/api/whatsapp", whatsappRoutes);
app.route("/api/whatsapp", createWebhookRoutes(webhookManager));

export const openAPIConfig = {
  openapi: "3.0.0" as const,
  info: {
    title: "WA Porta API",
    version,
    description: "WhatsApp Gateway REST API powered by Baileys",
  },
};

app.openAPIRegistry.registerComponent('securitySchemes', 'Bearer', {
  type: 'http',
  scheme: 'bearer',
});
app.openAPIRegistry.registerComponent('securitySchemes', 'ApiKeyAuth', {
  type: 'apiKey',
  in: 'header',
  name: 'X-API-Key',
});

app.doc("/openapi.json", openAPIConfig);
app.get("/doc", swaggerUI({ url: "/openapi.json" }));

app.get("/dashboard", (c) => c.redirect("/dashboard/"));
app.use(
  "/dashboard/*",
  serveStatic({
    root: "./dashboard/dist",
    rewriteRequestPath: (p) => p.replace("/dashboard", ""),
  }),
);

app.notFound((c) => c.json({ error: "Not Found" }, 404));
app.onError((err, c) => {
  if (err instanceof RecipientNotFoundError) {
    return c.json({ error: "recipient_not_found", message: err.message }, 422);
  }
  if (err instanceof SessionWarmingUpError) {
    return c.json(
      { error: "session_warming_up", message: err.message, retryAfterMs: err.remainingMs },
      429,
    );
  }
  if (err instanceof RateLimitExceededError) {
    return c.json(
      { error: "rate_limited", message: err.message, retryAfterMs: err.retryAfterMs },
      429,
    );
  }
  // Sesi belum siap / tidak ditemukan (mis. saat pra-cek isExist) bukan error
  // server internal — kembalikan 503 agar pemanggil bisa coba lagi nanti.
  if (err instanceof WhatsappError) {
    return c.json({ error: "session_unavailable", message: err.message }, 503);
  }
  console.error(err);
  if (err instanceof SyntaxError) {
    return c.json({ error: "Invalid or missing JSON body" }, 400);
  }
  return c.json({ error: err.message }, 500);
});

export default app;
