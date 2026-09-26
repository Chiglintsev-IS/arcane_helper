import { z } from "zod";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import { FIRE_SUPPRESSION_TURN_STARTS } from "./blood";

const maximumBase = z.number().int().positive();
const reduction = z.number().int().nonnegative();

const hitPointChange = z.number().int().positive();

export function isPossibleHitPointMaximum(maximum: number): boolean {
  return maximumBase.safeParse(maximum).success;
}

export function isPossibleReduction(amount: number): boolean {
  return reduction.safeParse(amount).success;
}

export function isPossibleHitPointChange(amount: number): boolean {
  return hitPointChange.safeParse(amount).success;
}

type HitPointCaps = { maximumBase: number; bloodReduction: number; masterReduction: number };

export function effectiveMaximum({ maximumBase, bloodReduction, masterReduction }: HitPointCaps): number {
  return maximumBase - bloodReduction - masterReduction;
}

const hitPointsSchema = z
  .object({
    current: z.number().int(),
    maximumBase,
    bloodReduction: reduction,
    masterReduction: reduction.default(0),
  })
  .refine((value) => value.current <= effectiveMaximum(value), {
    message: "Текущее здоровье не может превышать действующий максимум",
    path: ["current"],
  });

export function isPossibleEnteredHitPoints(current: number, maximum: number): boolean {
  return z.number().int().min(0).max(maximum).safeParse(current).success;
}

const temporaryHitPointsSchema = reduction.default(0);

export function isPossibleTemporaryHitPoints(amount: number): boolean {
  return temporaryHitPointsSchema.safeParse(amount).success;
}

const hitDiceSchema = z
  .object({
    total: z.number().int().positive(),
    size: z.number().int().positive(),
    remaining: z.number().int().nonnegative(),
  })
  .refine((value) => value.remaining <= value.total, {
    message: "Костей хитов не может остаться больше, чем есть",
    path: ["remaining"],
  })
  .optional();

const suppressionSchema = z.object({
  firedUponTurnStarts: z.number().int().min(0).max(FIRE_SUPPRESSION_TURN_STARTS),
  underDirectSunlight: z.boolean(),
});

export const VITALITY_FIELDS = {
  hitPoints: hitPointsSchema,
  temporaryHitPoints: temporaryHitPointsSchema,
  hitDice: hitDiceSchema,
  suppression: suppressionSchema,
};

const vitalityStateSchema = z.object(VITALITY_FIELDS);

export type VitalityState = DeepReadonly<z.infer<typeof vitalityStateSchema>>;
