import { z } from "zod";

import { paymentSchema, recipeFormulaSchema } from "./commands";

const numeric = z.number();

const whole = z.number().int();

const word = z.string().min(1);

export const questionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("health_preview"),
    maximumBase: numeric,
    masterReduction: numeric,
  }),
  z.object({ kind: z.literal("level_preview"), level: numeric }),
  z.object({
    kind: z.literal("cast_preview"),
    spellId: word,
    mode: word,
    payment: paymentSchema,
    rune: word.optional(),
    hitDiceCount: numeric.optional(),
    hitDiceRolled: numeric.optional(),
  }),
  z.object({
    kind: z.literal("recipe_preview"),
    formula: recipeFormulaSchema,
    portions: numeric,
  }),
  z.object({
    kind: z.literal("research_preview"),
    itemId: word,
    number: numeric,
  }),
  z.object({ kind: z.literal("export_preview") }),
  z.object({
    kind: z.literal("arcane_recovery_preview"),
    plan: z.record(word, numeric),
  }),
]);

export const previewSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("health_preview"),
    effectiveMaximum: whole.nullable(),
  }),
  z.object({
    kind: z.literal("level_preview"),
    changes: z.array(
      z.object({ of: word, slotLevel: whole.optional(), before: whole, after: whole }),
    ),
    hitPoints: z
      .object({ perDie: whole, dieSize: whole, constitution: whole, total: whole })
      .nullable(),
  }),
  z.object({
    kind: z.literal("cast_preview"),
    runes: z.object({
      effects: z.array(
        z.object({ rune: word, nameRu: word, effectRu: word, choosesTarget: z.boolean() }),
      ),
      unavailabilityRu: word.optional(),
    }),
    hitDice: z
      .object({
        maximum: whole,
        roll: z.object({ minimum: whole, maximum: whole }).optional(),
        modifier: whole,
        rollPossible: z.boolean().optional(),
        restored: whole.optional(),
      })
      .optional(),
  }),
  z.object({
    kind: z.literal("export_preview"),
    fileName: word,
    text: word,
  }),
  z.object({
    kind: z.literal("arcane_recovery_preview"),
    levelsSpent: whole,
    unavailabilityRu: word.optional(),
  }),
  z.object({
    kind: z.literal("research_preview"),
    plan: z
      .object({
        minutes: whole,
        difficulty: whole,
        portionsOnSuccess: whole,
        portionsOnFailure: whole,
        consumablesRu: word.nullable(),
        consumablesGold: whole,
        rawSampleRu: word.nullable(),
        requirementRu: word.nullable(),
      })
      .nullable(),
    refusalRu: word.optional(),
  }),
  z.object({
    kind: z.literal("recipe_preview"),
    spend: z.array(
      z.object({
        itemId: word,
        nameRu: word,
        portions: whole,
        inBagPortions: whole,
        shortPortions: whole,
      }),
    ),
    matches: z.array(
      z.object({ nameRu: word, sources: z.array(word), tier: word }),
    ),
    candidates: z.array(z.object({ itemId: word, matchedRu: z.array(word) })),
    difficulty: z
      .object({
        total: whole,
        parts: z.array(z.object({ nameRu: word, modifier: whole })),
        mainRu: word,
      })
      .nullable(),
    batch: z
      .object({
        minutes: whole,
        consumablesRu: word,
        goldPerStartedHour: whole,
        consumableKits: whole,
        consumablesGold: whole,
        units: whole,
      })
      .nullable(),
    warnings: z.array(z.object({ code: word, reasonRu: word })),
    noticesRu: z.array(word),
    check: z.object({ bonus: whole }).nullable(),
    known: z.boolean(),
    refusalRu: word.optional(),
  }),
]);

export type Question = z.infer<typeof questionSchema>;
export type Preview = z.infer<typeof previewSchema>;
export type PreviewOf<TKind extends Question["kind"]> = Extract<Preview, { kind: TKind }>;
