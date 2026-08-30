import { z } from "zod";

import { isoDateTime, nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import type { DeepReadonly } from "@/core/domain/shared/readonly";

const worldNoteSchema = z.object({
  id: nonEmpty,
  at: isoDateTime,
  text: nonEmpty,
});

export type WorldNote = DeepReadonly<z.infer<typeof worldNoteSchema>>;

export function worldNoteOf(value: unknown): WorldNote {
  return parsedOrRefused(worldNoteSchema, value, "заметка про мир");
}

export const NOTES_FIELDS = {
  worldNotes: z.array(worldNoteSchema).default([]),
};
