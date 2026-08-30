import { z } from "zod";

export const rawSaveSchema = z
  .object({
    fileName: z.string().min(1),
    text: z.string().min(1),
  })
  .nullable();

export type RawSave = z.infer<typeof rawSaveSchema>;
