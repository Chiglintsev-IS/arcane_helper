/**
 * Подсхема жизнеспособности: здоровье, временные хиты, Кости хитов, подавление.
 *
 * Пределы и инварианты контекста объявляются в нём самом — полное состояние персонажа собирает
 * сборка, спреду которой эти поля и достаются.
 */

import { z } from "zod";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import { FIRE_SUPPRESSION_TURN_STARTS } from "./blood";

/**
 * Здоровье тремя слагаемыми: база с листа и два снижения. Действующий максимум считается.
 * Одно поле «максимум, уже уменьшенный кровью» смешивало два факта, и правка базы требовала
 * вычесть снижение руками.
 */
const maximumBase = z.number().int().positive();
const reduction = z.number().int().nonnegative();

/** Правка хитов руками: урон, лечение и временные хиты называются положительным числом. */
const hitPointChange = z.number().int().positive();

/**
 * Годится ли введённое руками. Отвечают те же объявления, которыми проверяется сохранённое
 * состояние: второго правила о тех же числах не существует.
 */
export function isPossibleHitPointMaximum(maximum: number): boolean {
  return maximumBase.safeParse(maximum).success;
}

export function isPossibleReduction(amount: number): boolean {
  return reduction.safeParse(amount).success;
}

export function isPossibleHitPointChange(amount: number): boolean {
  return hitPointChange.safeParse(amount).success;
}

/** Слагаемые действующего максимума: с листа и оба снижения. */
type HitPointCaps = { maximumBase: number; bloodReduction: number; masterReduction: number };

/** Действующий максимум: база минус оба снижения. Схема и объект-значение читают одну функцию. */
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

/**
 * Временные хиты.
 *
 * Отдельным числом, а не прибавкой к текущим: сложенные вместе, они молча исказили бы и максимум,
 * и КС проверки концентрации.
 */
const temporaryHitPointsSchema = reduction.default(0);

/**
 * Кости хитов: по одной за уровень, размер задаёт класс — у волшебника d6.
 *
 * Поле необязательное: той же схемой проверяется импорт чужих данных, и выгрузка прежней версии не
 * обязана его знать. У Торна оно есть — этого требует тест контента.
 */
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

/**
 * Что подавляет расовые особенности: неотмеренный срок после урона огнём и прямое солнце.
 *
 * Остаток срока не бывает длиннее самого срока: число сверх него означало бы подавление, которого
 * правило не даёт.
 */
const suppressionSchema = z.object({
  firedUponTurnStarts: z.number().int().min(0).max(FIRE_SUPPRESSION_TURN_STARTS),
  underDirectSunlight: z.boolean(),
});

/** Поля контекста для сборки полной схемы состояния. */
export const VITALITY_FIELDS = {
  hitPoints: hitPointsSchema,
  temporaryHitPoints: temporaryHitPointsSchema,
  hitDice: hitDiceSchema,
  suppression: suppressionSchema,
};

const vitalityStateSchema = z.object(VITALITY_FIELDS);

export type VitalityState = DeepReadonly<z.infer<typeof vitalityStateSchema>>;
