import { router, publicProcedure } from "../index.js";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    return ctx.session?.user ?? null;
  }),
});
