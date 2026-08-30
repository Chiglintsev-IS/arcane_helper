import { z } from "zod";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import { MAXIMUM_SPELL_LEVEL } from "@/core/domain/catalog/spell";
import { MINIMUM_SPELL_LEVEL } from "@/core/domain/arcana/slots";

const slotSchema = z
  .object({
    maximum: z.number().int().nonnegative(),
    remaining: z.number().int(),
  })
  .refine((slot) => slot.remaining <= slot.maximum, {
    message: "Осталось ячеек не может быть больше максимума",
    path: ["remaining"],
  });

const spellSlotsSchema = z.record(
  z.coerce.number().int().min(MINIMUM_SPELL_LEVEL).max(MAXIMUM_SPELL_LEVEL),
  slotSchema,
);

const arcaneRecoverySchema = z
  .object({
    maximum: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
  })
  .refine((value) => value.remaining <= value.maximum, {
    message: "Бюджет магического восстановления не может остаться больше максимума",
    path: ["remaining"],
  });

const runesSchema = z
  .object({
    maximum: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
  })
  .refine((value) => value.remaining <= value.maximum, {
    message: "Рун не может остаться больше максимума",
    path: ["remaining"],
  });

const LAST_HINT_MAXIMUM = 1;

const lastHintSchema = z
  .object({
    maximum: z.number().int().nonnegative(),
    remaining: z.number().int().nonnegative(),
  })
  .refine((value) => value.remaining <= value.maximum, {
    message: "Подсказок не может остаться больше максимума",
    path: ["remaining"],
  })
  .default({ maximum: LAST_HINT_MAXIMUM, remaining: LAST_HINT_MAXIMUM });

const shortRestSinceLongRestSchema = z.boolean().optional();

export const ARCANA_FIELDS = {
  spellSlots: spellSlotsSchema,
  arcaneRecovery: arcaneRecoverySchema,
  shortRestSinceLongRest: shortRestSinceLongRestSchema,
  runes: runesSchema,
  lastHint: lastHintSchema,
};

const arcanaStateSchema = z.object(ARCANA_FIELDS);

export type ArcanaStateData = DeepReadonly<z.infer<typeof arcanaStateSchema>>;
