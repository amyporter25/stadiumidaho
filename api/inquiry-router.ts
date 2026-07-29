import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { inquiries } from "@db/schema";

export const inquiryRouter = createRouter({
  create: publicQuery
    .input(
      z.object({
        fullName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        interest: z.string().min(1),
        lotId: z.string().optional(),
        lotTitle: z.string().optional(),
        timeframe: z.string().optional(),
        message: z.string().optional(),
        userId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(inquiries).values({
        userId: input.userId ?? null,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone ?? null,
        interest: input.interest,
        lotId: input.lotId ?? null,
        lotTitle: input.lotTitle ?? null,
        timeframe: input.timeframe ?? null,
        message: input.message ?? null,
      });
      return { id: Number(result[0].insertId), success: true };
    }),
});
