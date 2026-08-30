import { z } from "zod";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import { nonEmpty } from "@/core/domain/shared/schema";

export const SPELLBOOK_FIELDS = {
  cantripIds: z.array(nonEmpty),
  spellbookSpellIds: z.array(nonEmpty),
  preparedSpellIds: z.array(nonEmpty),
  spellNotes: z.record(nonEmpty, nonEmpty),
};

const spellbookStateSchema = z.object(SPELLBOOK_FIELDS).superRefine(refineSpellbook);

export type SpellbookState = DeepReadonly<z.infer<typeof spellbookStateSchema>>;

export function refineSpellbook(value: SpellbookState, context: z.core.$RefinementCtx): void {
  for (const field of ["cantripIds", "spellbookSpellIds", "preparedSpellIds"] as const) {
    const ids = value[field];
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: "Список содержит повторяющиеся идентификаторы",
      });
    }
  }

  const cantrips = new Set(value.cantripIds);
  for (const id of value.spellbookSpellIds) {
    if (cantrips.has(id)) {
      context.addIssue({
        code: "custom",
        path: ["spellbookSpellIds"],
        message: `Заклинание «${id}» одновременно заговор и запись в книге`,
      });
      break;
    }
  }

  const spellbook = new Set(value.spellbookSpellIds);
  for (const id of value.preparedSpellIds) {
    if (!spellbook.has(id)) {
      context.addIssue({
        code: "custom",
        path: ["preparedSpellIds"],
        message: `Подготовлено заклинание «${id}», которого нет в книге`,
      });
      break;
    }
  }
}
