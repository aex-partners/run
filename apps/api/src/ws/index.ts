import type { FastifyInstance } from "fastify";
import type { WebSocket } from "@fastify/websocket";
import { auth } from "../auth/index.js";

const connections = new Map<string, Set<WebSocket>>();

export function registerWebSocket(app: FastifyInstance) {
  app.get("/ws", { websocket: true }, async (socket, req) => {
    // Authenticate via cookie
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }

    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      socket.send(JSON.stringify({ type: "error", message: "Unauthorized" }));
      socket.close();
      return;
    }

    const userId = session.user.id;

    // Support multiple connections per user
    let userSockets = connections.get(userId);
    if (!userSockets) {
      userSockets = new Set();
      connections.set(userId, userSockets);
    }
    userSockets.add(socket);

    socket.on("close", () => {
      const sockets = connections.get(userId);
      if (sockets) {
        sockets.delete(socket);
        if (sockets.size === 0) {
          connections.delete(userId);
        }
      }
    });

    socket.on("message", (data) => {
      try {
        const parsed = JSON.parse(String(data));
        if (parsed.type === "ping") {
          socket.send(JSON.stringify({ type: "pong" }));
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.send(JSON.stringify({ type: "connected", userId }));
  });
}

export function broadcast(message: unknown) {
  const payload = JSON.stringify(message);
  for (const sockets of connections.values()) {
    for (const socket of sockets) {
      socket.send(payload);
    }
  }

  // Check event triggers for matching events (async, fire and forget)
  const msg = message as Record<string, unknown>;
  if (msg.type === "record_updated" || msg.type === "entity_updated") {
    import("../workflows/triggers.js").then(({ checkEventTriggers }) => {
      import("../db/index.js").then(({ db }) => {
        checkEventTriggers(msg.type as string, msg as Record<string, unknown>, db).catch((err) => {
          console.error("Event trigger check failed:", err);
        });
      });
    });
  }
}

export function sendToUser(userId: string, message: unknown) {
  const sockets = connections.get(userId);
  if (sockets) {
    const payload = JSON.stringify(message);
    for (const socket of sockets) {
      socket.send(payload);
    }
  }
}

export function sendToConversation(memberIds: string[], message: unknown) {
  const payload = JSON.stringify(message);
  for (const userId of memberIds) {
    const sockets = connections.get(userId);
    if (sockets) {
      for (const socket of sockets) {
        socket.send(payload);
      }
    }
  }
}
