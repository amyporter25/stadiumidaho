import { authRouter } from "./auth-router";
import { inquiryRouter } from "./inquiry-router";
import { lotsRouter } from "./lots-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  inquiry: inquiryRouter,
  lots: lotsRouter,
});

export type AppRouter = typeof appRouter;
