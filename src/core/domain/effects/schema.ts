import { z } from "zod";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import { MAXIMUM_SPELL_LEVEL } from "@/core/domain/catalog/spell";
import { effectDurationSchema } from "@/core/domain/effects/duration";
import { isoDateTime, nonEmpty } from "@/core/domain/shared/schema";
import { statContributionSchema } from "@/core/domain/shared/stats";

const activeEffectSchema = z.object({
  id: nonEmpty,
  spellId: nonEmpty.optional(),
  nameRu: nonEmpty,

  startedAt: isoDateTime,

  duration: effectDurationSchema,

  isConcentration: z.boolean(),
  slotLevelUsed: z.number().int().min(0).max(MAXIMUM_SPELL_LEVEL),

  repeatableAction: z
    .object({ label: nonEmpty, description: nonEmpty })
    .optional(),

  contributions: z.array(statContributionSchema).default([]),

  manualKind: z.literal("armorAdjustment").optional(),

  endConditionRu: nonEmpty,
  note: nonEmpty.optional(),
});

const concentrationSchema = z
  .object({ spellId: nonEmpty, startedAt: isoDateTime })
  .optional();

export const EFFECTS_FIELDS = {
  activeEffects: z.array(activeEffectSchema),
  concentration: concentrationSchema,
};

export type ActiveEffect = DeepReadonly<z.infer<typeof activeEffectSchema>>;
type Concentration = z.infer<typeof concentrationSchema>;

export type EffectsState = DeepReadonly<{
  activeEffects: ActiveEffect[];
  concentration?: Concentration;
}>;

export function refineEffects(value: EffectsState, context: z.core.$RefinementCtx): void {
  if (value.concentration !== undefined) {
    const matching = value.activeEffects.find(
      (effect) => effect.isConcentration && effect.spellId === value.concentration?.spellId,
    );
    if (matching === undefined) {
      context.addIssue({
        code: "custom",
        path: ["activeEffects"],
        message: "Активная концентрация без соответствующего активного эффекта",
      });
    }
  }

  const concentrationEffects = value.activeEffects.filter((effect) => effect.isConcentration);
  if (concentrationEffects.length > 1) {
    context.addIssue({
      code: "custom",
      path: ["activeEffects"],
      message: `Одновременно активно ${concentrationEffects.length} концентрационных эффекта`,
    });
  }
}
