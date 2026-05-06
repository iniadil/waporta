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
  console.error(err);
  if (err instanceof SyntaxError) {
    return c.json({ error: "Invalid or missing JSON body" }, 400);
  }
  return c.json({ error: err.message }, 500);
});

export default app;
