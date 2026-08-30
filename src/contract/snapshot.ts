import { z } from "zod";

import {
  activeEffectViewSchema,
  bagViewSchema,
  castingViewSchema,
  choicesViewSchema,
  concentrationViewSchema,
  craftingViewSchema,
  recoveryViewSchema,
  resourcesViewSchema,
  sheetViewSchema,
  spellRowViewSchema,
  turnViewSchema,
} from "./views";

export const logEntryViewSchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  kind: z.string().min(1),
  summaryRu: z.string().min(1),
  spellId: z.string().min(1).optional(),
  slotLevel: z.number().int().optional(),
});

export const worldNoteViewSchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  text: z.string().min(1),
});

export const snapshotSchema = z.object({
  version: z.number().int().nonnegative(),
  sheet: sheetViewSchema,
  bag: bagViewSchema,
  crafting: craftingViewSchema,
  resources: resourcesViewSchema,
  recovery: recoveryViewSchema,
  turn: turnViewSchema,
  concentration: concentrationViewSchema.optional(),
  effects: z.array(activeEffectViewSchema),
  casting: castingViewSchema,
  spells: z.array(spellRowViewSchema),
  spellsRefusalRu: z.string().min(1).optional(),
  choices: choicesViewSchema,
  catalogSource: z.string().min(1),
  log: z.array(logEntryViewSchema),
  notes: z.array(worldNoteViewSchema),
});

export type Snapshot = z.infer<typeof snapshotSchema>;
