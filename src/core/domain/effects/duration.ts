import { z } from "zod";

const DURATION_TYPES = [
  "rounds",
  "minutes",
  "hours",
  "until_spell_ends",
  "until_removed",
] as const;

type EffectDurationType = (typeof DURATION_TYPES)[number];

const OUTLASTS_LONG_REST: Record<EffectDurationType, boolean> = {
  rounds: false,
  minutes: false,
  hours: false,
  until_spell_ends: true,
  until_removed: false,
};

export const effectDurationSchema = z.object({
  type: z.enum(DURATION_TYPES),
  value: z.number().int().positive().optional(),
});

export function outlastsLongRest(duration: { readonly type: EffectDurationType }): boolean {
  return OUTLASTS_LONG_REST[duration.type];
}
