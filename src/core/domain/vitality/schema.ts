/**
 * Подсхема жизнеспособности: здоровье, временные хиты, Кости хитов, подавление.
 *
 * Пределы и инварианты контекста объявляются в нём самом — полное состояние персонажа собирает
 * сборка, спреду которой эти поля и достаются.
 */

import { z } from "zod";

/**
 * Здоровье тремя слагаемыми: база с листа и два снижения. Действующий максимум считается.
 * Одно поле «максимум, уже уменьшенный кровью» смешивало два факта, и правка базы требовала
 * вычесть снижение руками.
 */
const hitPointsSchema = z
  .object({
    current: z.number().int(),
    maximumBase: z.number().int().positive(),
    bloodReduction: z.number().int().nonnegative(),
    masterReduction: z.number().int().nonnegative().default(0),
  })
  .refine(
    (value) => value.current <= value.maximumBase - value.bloodReduction - value.masterReduction,
    {
      message: "Текущее здоровье не может превышать действующий максимум",
      path: ["current"],
    },
  );

/**
 * Временные хиты.
 *
 * Отдельным числом, а не прибавкой к текущим: сложенные вместе, они молча исказили бы и максимум,
 * и КС проверки концентрации.
 */
const temporaryHitPointsSchema = z.number().int().nonnegative().default(0);

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

/** Что подавляет расовые особенности: урон огнём до конца следующего хода и прямое солнце. */
const suppressionSchema = z.object({
  firedUpon: z.boolean(),
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

export type VitalityState = z.infer<typeof vitalityStateSchema>;
export type HitDice = NonNullable<z.infer<typeof hitDiceSchema>>;
