import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import { auth } from "../auth/index.js";
import { db } from "../db/index.js";

export async function createContext({ req, res }: CreateFastifyContextOptions) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const session = await auth.api.getSession({ headers });

  return {
    db,
    session,
    req,
    res,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
