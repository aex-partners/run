import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import multipart from "@fastify/multipart";
import {
  fastifyTRPCPlugin,
  type FastifyTRPCPluginOptions,
} from "@trpc/server/adapters/fastify";
import { env } from "./env.js";
import { auth } from "./auth/index.js";
import { appRouter, type AppRouter } from "./trpc/router.js";
import { createContext } from "./trpc/context.js";
import { registerWebSocket } from "./ws/index.js";
import { registerUploadRoutes } from "./routes/upload.js";

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(cookie);
  await app.register(websocket);
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024 } });

  // Health check
  app.get("/health", async () => ({ status: "ok" }));

  // better-auth handler
  app.all("/api/auth/*", async (req, reply) => {
    const url = new URL(req.url, env.BETTER_AUTH_URL);
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const response = await auth.handler(
      new Request(url, {
        method: req.method,
        headers,
        body: req.method !== "GET" && req.method !== "HEAD"
          ? JSON.stringify(req.body)
          : undefined,
      }),
    );

    const resHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      resHeaders[key] = value;
    });

    return reply
      .status(response.status)
      .headers(resHeaders)
      .send(await response.text());
  });

  // AI Chat (Claude Agent SDK)
  const { registerChatRoutes } = await import("./ai/index.js");
  registerChatRoutes(app);

  // tRPC
  await app.register(fastifyTRPCPlugin, {
    prefix: "/api/trpc",
    trpcOptions: {
      router: appRouter,
      createContext,
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });

  // Bling webhook endpoint (must be before generic :integrationId route)
  app.post("/api/webhooks/bling/:integrationId", async (req, reply) => {
    const { integrationId } = req.params as { integrationId: string };
    const { eq } = await import("drizzle-orm");
    const { db } = await import("./db/index.js");
    const { integrations } = await import("./db/schema/index.js");
    const { verifyBlingWebhook } = await import("./bling/webhook.js");
    const { decryptCredentials } = await import("./integrations/crypto.js");

    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, integrationId))
      .limit(1);

    if (!integration || integration.status !== "enabled") {
      return reply.status(404).send({ error: "Integration not found or disabled" });
    }

    // Verify Bling signature
    const signature = req.headers["x-bling-signature-256"] as string | undefined;
    if (!signature) {
      return reply.status(401).send({ error: "Missing Bling webhook signature" });
    }

    const creds = decryptCredentials(integration.credentials!) as { clientSecret: string };
    const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (!verifyBlingWebhook(rawBody, signature, creds.clientSecret)) {
      return reply.status(401).send({ error: "Invalid Bling webhook signature" });
    }

    // Enqueue a sync for the updated resource
    const { enqueueBlingSync } = await import("./queue/bling-queue.js");
    await enqueueBlingSync(integrationId);

    return reply.status(200).send({ received: true });
  });

  // Webhook endpoint for integrations
  app.all("/api/webhooks/:integrationId", async (req, reply) => {
    const { integrationId } = req.params as { integrationId: string };
    const { eq } = await import("drizzle-orm");
    const { db } = await import("./db/index.js");
    const { integrations } = await import("./db/schema/index.js");

    const [integration] = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, integrationId))
      .limit(1);

    if (!integration || integration.status !== "enabled") {
      return reply.status(404).send({ error: "Integration not found or disabled" });
    }

    // Verify webhook secret if configured
    if (integration.webhookSecret) {
      const signature = req.headers["x-webhook-signature"] || req.headers["x-hub-signature-256"];
      if (!signature) {
        return reply.status(401).send({ error: "Missing webhook signature" });
      }
      const { createHmac, timingSafeEqual } = await import("node:crypto");
      const rawBody = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const expected = "sha256=" + createHmac("sha256", integration.webhookSecret).update(rawBody).digest("hex");
      const sigStr = Array.isArray(signature) ? signature[0] : signature;
      const expectedBuf = Buffer.from(expected);
      const sigBuf = Buffer.from(sigStr ?? "");
      if (!sigStr || expectedBuf.length !== sigBuf.length || !timingSafeEqual(expectedBuf, sigBuf)) {
        return reply.status(401).send({ error: "Invalid webhook signature" });
      }
    }

    const { broadcast } = await import("./ws/index.js");
    broadcast({
      type: "webhook_received",
      integrationId,
      integrationName: integration.name,
      payload: req.body,
    });

    return reply.status(200).send({ received: true });
  });

  // Webhook endpoint for flow triggers (must be registered before the generic :integrationId route)
  app.all("/api/flow-webhooks/:flowId", async (req, reply) => {
    const { flowId } = req.params as { flowId: string };
    const { handleWebhook } = await import("./flow-engine/webhook-handler.js");
    const { db } = await import("./db/index.js");

    const headers: Record<string, string | string[] | undefined> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      headers[key] = value;
    }

    const queryParams: Record<string, string | string[] | undefined> = {};
    if (req.query && typeof req.query === "object") {
      for (const [key, value] of Object.entries(req.query as Record<string, string>)) {
        queryParams[key] = value;
      }
    }

    const result = await handleWebhook(
      flowId,
      { body: req.body, headers, queryParams },
      db,
    );

    if ("error" in result) {
      return reply.status(result.status).send({ error: result.error });
    }

    return reply.status(200).send({ runId: result.runId });
  });

  // OAuth2 callback for plugin credentials
  app.get("/api/credentials/oauth2/callback", async (req, reply) => {
    const { code, state } = req.query as { code: string; state: string };
    if (!code || !state) {
      return reply.status(400).send({ error: "Missing code or state" });
    }

    try {
      const { handlePluginOAuth2Callback } = await import("./credentials/oauth2-handler.js");
      const { db } = await import("./db/index.js");

      const result = await handlePluginOAuth2Callback({
        db,
        code,
        state,
        baseUrl: env.BETTER_AUTH_URL || `http://localhost:${env.PORT || 3001}`,
      });

      // Close popup and notify parent window
      const successPayload = JSON.stringify({ type: 'plugin-oauth-complete', pluginName: result.pluginName, credentialId: result.credentialId });
      return reply.type("text/html").send(`
        <html><body><script>
          window.opener?.postMessage(${successPayload}, ${JSON.stringify(env.CORS_ORIGIN)});
          window.close();
        </script><p>Connected. You can close this window.</p></body></html>
      `);
    } catch (error) {
      console.error("Plugin OAuth2 callback error:", error);
      const errorPayload = JSON.stringify({ type: 'plugin-oauth-error', error: (error as Error).message });
      return reply.type("text/html").send(`
        <html><body><script>
          window.opener?.postMessage(${errorPayload}, ${JSON.stringify(env.CORS_ORIGIN)});
          window.close();
        </script><p>Connection failed. You can close this window.</p></body></html>
      `);
    }
  });

  // Bling OAuth callback
  app.get("/api/auth/bling/callback", async (req, reply) => {
    const { code, state } = req.query as { code: string; state: string };
    if (!code || !state) {
      return reply.status(400).send({ error: "Missing code or state" });
    }

    try {
      const { verifyOAuthState } = await import("./utils/oauth-state.js");
      const stateData = verifyOAuthState(state) as {
        provider: "bling";
        userId: string;
        secrets: string;
      };
      if (!stateData) {
        return reply.status(400).send({ error: "Invalid or tampered state parameter" });
      }

      const { exchangeBlingCode } = await import("./bling/oauth.js");
      const { encryptCredentials, decryptCredentials } = await import("./integrations/crypto.js");

      // Decrypt the secrets from state
      const { clientId, clientSecret } = decryptCredentials(stateData.secrets) as {
        clientId: string;
        clientSecret: string;
      };
      const { db } = await import("./db/index.js");
      const { integrations, credentials } = await import("./db/schema/index.js");
      const { ensureBlingEntities } = await import("./bling/entities.js");
      const { enqueueBlingSync } = await import("./queue/bling-queue.js");

      const tokens = await exchangeBlingCode(clientId, clientSecret, code);

      const credentialValue = {
        clientId,
        clientSecret,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: Date.now() + tokens.expiresIn * 1000,
      };

      // Store in integrations table (for sync worker)
      const integrationId = crypto.randomUUID();
      await db.insert(integrations).values({
        id: integrationId,
        name: "Bling ERP",
        slug: `bling-${Date.now()}`,
        type: "oauth2",
        status: "enabled",
        config: JSON.stringify({
          authUrl: "https://www.bling.com.br/Api/v3/oauth/authorize",
          tokenUrl: "https://www.bling.com.br/Api/v3/oauth/token",
          syncInterval: 15 * 60 * 1000,
        }),
        credentials: encryptCredentials(credentialValue),
        createdBy: stateData.userId,
      });

      // Store in credentials table (for piece system)
      await db.insert(credentials).values({
        id: crypto.randomUUID(),
        name: "Bling ERP (OAuth2)",
        pluginName: "piece-bling",
        type: "custom_auth",
        status: "active",
        value: encryptCredentials(credentialValue),
        createdBy: stateData.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await ensureBlingEntities(db, stateData.userId);
      await enqueueBlingSync(integrationId);

      return reply.redirect(`${env.CORS_ORIGIN}/settings?section=integrations`);
    } catch (error) {
      console.error("Bling OAuth callback error:", error);
      return reply.status(500).send({ error: "Bling OAuth callback failed" });
    }
  });

  // Speech-to-Text: transcribe audio via Whisper
  app.post("/api/voice/transcribe", async (req, reply) => {
    try {
      const data = await req.file();
      if (!data) {
        return reply.status(400).send({ error: "Missing audio file" });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);

      const { experimental_transcribe: transcribe } = await import("ai");
      const { getProvider } = await import("./ai/client.js");
      const provider = await getProvider();

      const result = await transcribe({
        model: provider.transcription("whisper-1"),
        audio: audioBuffer,
      });

      return reply.send({ text: result.text });
    } catch (err) {
      console.error("Transcription error:", err);
      return reply.status(500).send({ error: "Transcription failed" });
    }
  });

  // Text-to-Speech: generate audio via OpenAI TTS
  app.post("/api/voice/tts", async (req, reply) => {
    const { text, voice } = req.body as { text?: string; voice?: string };
    if (!text) {
      return reply.status(400).send({ error: "Missing text" });
    }

    try {
      const { experimental_generateSpeech: generateSpeech } = await import("ai");
      const { getProvider } = await import("./ai/client.js");
      const provider = await getProvider();

      const result = await generateSpeech({
        model: provider.speech("tts-1"),
        text: text.slice(0, 4096),
        voice: (voice as "alloy") || "echo",
      });

      reply
        .header("Content-Type", "audio/mpeg")
        .header("Cache-Control", "no-cache")
        .send(Buffer.from(result.audio.uint8Array));
    } catch (err) {
      console.error("TTS error:", err);
      return reply.status(500).send({ error: "TTS generation failed" });
    }
  });

  // Legacy TTS endpoint (backwards compat)
  app.post("/api/tts", async (req, reply) => {
    const { text, voice } = req.body as { text?: string; voice?: string };
    if (!text) return reply.status(400).send({ error: "Missing text" });
    try {
      const { experimental_generateSpeech: generateSpeech } = await import("ai");
      const { getProvider } = await import("./ai/client.js");
      const provider = await getProvider();
      const result = await generateSpeech({
        model: provider.speech("tts-1"),
        text: text.slice(0, 4096),
        voice: (voice as "alloy") || "echo",
      });
      reply.header("Content-Type", "audio/mpeg").header("Cache-Control", "no-cache")
        .send(Buffer.from(result.audio.uint8Array));
    } catch (err) {
      console.error("TTS error:", err);
      return reply.status(500).send({ error: "TTS generation failed" });
    }
  });

  // Upload routes (audio, files)
  registerUploadRoutes(app);

  // WebSocket
  registerWebSocket(app);

  return app;
}
