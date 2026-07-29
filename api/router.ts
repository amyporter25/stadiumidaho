import { authRouter } from "./auth-router";
import { inquiryRouter } from "./inquiry-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  inquiry: inquiryRouter,
});

export type AppRouter = typeof appRouter;
