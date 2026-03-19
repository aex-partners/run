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

  // tRPC
  await app.register(fastifyTRPCPlugin, {
    prefix: "/api/trpc",
    trpcOptions: {
      router: appRouter,
      createContext,
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
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
      // Basic signature check (integration-specific verification can be added)
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

  // OAuth callback for email
  app.get("/api/auth/email/callback", async (req, reply) => {
    const { code, state } = req.query as { code: string; state: string };
    if (!code || !state) {
      return reply.status(400).send({ error: "Missing code or state" });
    }

    try {
      const stateData = JSON.parse(Buffer.from(state, "base64url").toString()) as {
        provider: "gmail" | "outlook";
        userId: string;
        returnTo?: string;
      };

      const { exchangeCode } = await import("./integrations/oauth.js");
      const { encryptCredentials } = await import("./integrations/crypto.js");
      const { db } = await import("./db/index.js");
      const { integrations, emailAccounts } = await import("./db/schema/index.js");

      const oauthConfig = stateData.provider === "gmail"
        ? {
            authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
            tokenUrl: "https://oauth2.googleapis.com/token",
            clientId: process.env.GMAIL_CLIENT_ID || "",
            clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
            redirectUri: `${env.BETTER_AUTH_URL}/api/auth/email/callback`,
          }
        : {
            authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            clientId: process.env.OUTLOOK_CLIENT_ID || "",
            clientSecret: process.env.OUTLOOK_CLIENT_SECRET || "",
            redirectUri: `${env.BETTER_AUTH_URL}/api/auth/email/callback`,
          };

      const tokens = await exchangeCode(oauthConfig, code);

      // Fetch email address from provider
      let emailAddress = "";
      let displayName = "";

      if (stateData.provider === "gmail") {
        const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        const profile = await profileRes.json() as { emailAddress: string };
        emailAddress = profile.emailAddress;
        displayName = emailAddress;
      } else {
        const profileRes = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        const profile = await profileRes.json() as { mail: string; displayName: string };
        emailAddress = profile.mail;
        displayName = profile.displayName || emailAddress;
      }

      // Create integration
      const integrationId = crypto.randomUUID();
      await db.insert(integrations).values({
        id: integrationId,
        name: `${stateData.provider} - ${emailAddress}`,
        slug: `email-${stateData.provider}-${Date.now()}`,
        type: "oauth2",
        status: "enabled",
        credentials: encryptCredentials({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresIn ? Date.now() + tokens.expiresIn * 1000 : undefined,
        }),
        createdBy: stateData.userId,
      });

      // Create email account
      const accountId = crypto.randomUUID();
      await db.insert(emailAccounts).values({
        id: accountId,
        integrationId,
        emailAddress,
        displayName,
        provider: stateData.provider,
        ownerId: stateData.userId,
      });

      // Trigger first sync
      const { enqueueEmailSync } = await import("./queue/email-queue.js");
      await enqueueEmailSync(accountId);

      // Redirect back to app
      const redirectTo = stateData.returnTo || "/mail";
      return reply.redirect(`${env.CORS_ORIGIN}${redirectTo}`);
    } catch (error) {
      console.error("Email OAuth callback error:", error);
      return reply.status(500).send({ error: "OAuth callback failed" });
    }
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
      return reply.type("text/html").send(`
        <html><body><script>
          window.opener?.postMessage({ type: 'plugin-oauth-complete', pluginName: '${result.pluginName}', credentialId: '${result.credentialId}' }, '*');
          window.close();
        </script><p>Connected. You can close this window.</p></body></html>
      `);
    } catch (error) {
      console.error("Plugin OAuth2 callback error:", error);
      return reply.type("text/html").send(`
        <html><body><script>
          window.opener?.postMessage({ type: 'plugin-oauth-error', error: '${(error as Error).message}' }, '*');
          window.close();
        </script><p>Connection failed. You can close this window.</p></body></html>
      `);
    }
  });

  // Upload routes (audio, files)
  registerUploadRoutes(app);

  // WebSocket
  registerWebSocket(app);

  return app;
}
