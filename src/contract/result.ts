import { z } from "zod";

import { snapshotSchema } from "./snapshot";

export const resultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), snapshot: snapshotSchema }),
  z.object({ ok: z.literal(false), reasonRu: z.string().min(1) }),
]);

export type Result = z.infer<typeof resultSchema>;
