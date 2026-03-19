import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@aex/api/trpc";

export const trpc = createTRPCReact<AppRouter>();
