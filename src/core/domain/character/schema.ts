import { z } from "zod";

import { DomainError } from "@/core/domain/shared/errors";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import {
  MAXIMUM_CHARACTER_LEVEL,
  MINIMUM_CHARACTER_LEVEL,
} from "@/core/domain/shared/levels";
import {
  MAXIMUM_ABILITY_SCORE,
  MAXIMUM_EXHAUSTION,
  MINIMUM_ABILITY_SCORE,
} from "@/core/domain/character/abilities";
import { nonEmpty, parsedOrRefused, russianSchemaErrors } from "@/core/domain/shared/schema";
import { ABILITIES, SKILL_IDS, statContributionSchema } from "@/core/domain/shared/stats";

import { SKILL_TRAINING } from "./skills";

const roleplayProfileSchema = z.object({
  tone: z.array(z.enum(["serious", "mysterious", "sarcastic", "wild"])).min(1),
  magicThemes: z.array(nonEmpty),
  speechStyle: nonEmpty,
  gestureStyle: nonEmpty,
  preferredElements: z.array(nonEmpty),
  prohibitedThemes: z.array(nonEmpty),
  maximumPhraseLength: z.number().int().positive(),
});

/**
 * Величины персонажа объявлены по одному разу: то же объявление проверяет и сохранённое состояние, и
 * правку с экрана. Второй проверки того же факта в приложении нет — разойтись им было бы нечем.
 */
const abilityScore = z
  .number()
  .int()
  .min(MINIMUM_ABILITY_SCORE)
  .max(MAXIMUM_ABILITY_SCORE);

const characterLevel = z
  .number()
  .int()
  .min(MINIMUM_CHARACTER_LEVEL)
  .max(MAXIMUM_CHARACTER_LEVEL);

const age = z.number().int().nonnegative();
const speedFeet = z.number().int().nonnegative();

/** Размер существа: из перечисления правил, потому что от него зависят правила захвата и укрытия. */
export const CREATURE_SIZES = [
  "tiny",
  "small",
  "medium",
  "large",
  "huge",
  "gargantuan",
] as const;

const abilitiesSchema = z.object({
  strength: abilityScore,
  dexterity: abilityScore,
  constitution: abilityScore,
  intelligence: abilityScore,
  wisdom: abilityScore,
  charisma: abilityScore,
});

/** Бывает ли такой уровень: отвечает то же объявление, которым проверяется состояние. */
export function isPossibleCharacterLevel(level: number): boolean {
  return characterLevel.safeParse(level).success;
}

/**
 * Поля листа с наложенной правкой — разобранные объявлениями, или отказ с причиной словами.
 *
 * Правка приходит непроверенной: экран передаёт набранное как есть. Разбирается персонаж целиком, а
 * не пришедшие поля по одному, потому что целым он и хранится — умолчания объявлений попадают в
 * состояние, а не в отброшенный результат проверки, и после правки лист заведомо цел. Другого места,
 * где эти числа проверяются, нет: экран получает либо новое состояние, либо отказ.
 */
export function parsedCharacterFields(
  fields: CharacterFields,
  patch: Partial<Record<keyof typeof CHARACTER_FIELDS, unknown>>,
): CharacterFields {
  const parsed = characterSchema.safeParse(
    { ...fields, ...patch },
    { error: russianSchemaErrors },
  );
  if (!parsed.success) throw new DomainError(refusalOf(parsed.error));
  return parsed.data;
}

/** Отказ называет поле и причину словами объявления: их показывают там, где набирали. */
function refusalOf(error: z.ZodError): string {
  const [field] = error.issues.map((issue) => String(issue.path[0]));
  return `Поле «${field}» не годится: ${reasonsOf(error)}`;
}

/** Причины отказа словами: их называет само объявление поля. */
function reasonsOf(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

/**
 * Постоянный вклад: прибавка или назначение без вещи и без срока — раса, дар, слово мастера.
 *
 * Свойство персонажа, а не эффект: у эффекта есть окончание, а у расы его нет. Правится он с
 * «Листа» и обратим журналом, как всякая правка базы.
 *
 * Имя рядом со вкладом обязательно: «откуда взялось +2» — вопрос, который за столом задают чаще
 * самого числа, и разбор без имени на него не отвечает.
 */
const permanentContributionSchema = z.object({
  nameRu: nonEmpty,
  contribution: statContributionSchema,
});

/**
 * Постоянный вклад из сообщения снаружи: объявление проверяет его само и отказывает с причиной.
 *
 * Наружу отдаётся сужение, а не схема: пусти схему за границу, и её начнут расширять на месте, а
 * объявление вклада перестанет быть одним.
 */
export function permanentContributionOf(value: unknown): PermanentContribution {
  return parsedOrRefused(permanentContributionSchema, value, "постоянный вклад");
}

/**
 * Двух назначений на одну величину не бывает.
 *
 * Движок конфликтов не разрешает и наибольшее не выбирает: тихий выбор решал бы за игрока, какое из
 * двух слов мастера считать настоящим. Второе отклоняется с причиной, и снять прежнее — его дело.
 */
const permanentContributions = z
  .array(permanentContributionSchema)
  .superRefine((permanent, context) => {
    const assigned = new Set<string>();
    for (const [index, { contribution }] of permanent.entries()) {
      if (contribution.kind !== "assignment") continue;
      if (assigned.has(contribution.stat)) {
        context.addIssue({
          code: "custom",
          path: [index],
          message: `Величине «${contribution.stat}» уже назначено число: снимите прежнее назначение, второго не бывает`,
        });
      }
      assigned.add(contribution.stat);
    }
  })
  .default([]);

/** Поля контекста для сборки полной схемы состояния. */
export const CHARACTER_FIELDS = {
  id: nonEmpty,
  name: nonEmpty,
  className: nonEmpty,
  level: characterLevel,
  species: nonEmpty.or(z.literal("")).default(""),
  subclass: nonEmpty.or(z.literal("")).default(""),
  age: age.default(0),
  size: z.enum(CREATURE_SIZES).default("medium"),
  speed: speedFeet.default(30),

  abilities: abilitiesSchema,
  saveProficiencies: z.array(z.enum(ABILITIES)).default([]),
  skills: z
    .partialRecord(z.enum(SKILL_IDS), z.enum(SKILL_TRAINING))
    .default({}),
  proficiencies: z
    .object({
      weapons: z.array(nonEmpty).default([]),
      armor: z.array(nonEmpty).default([]),
      tools: z.array(nonEmpty).default([]),
      languages: z.array(nonEmpty).default([]),
    })
    .default({ weapons: [], armor: [], tools: [], languages: [] }),

  permanentContributions,

  /** Отметки на листе: их ставят и снимают там же, где смотрят, — на «Листе». */
  exhaustion: z.number().int().min(0).max(MAXIMUM_EXHAUSTION).default(0),
  inspiration: z.boolean().default(false),

  roleplayProfile: roleplayProfileSchema,
};

const characterSchema = z.object(CHARACTER_FIELDS);

export type CharacterFields = DeepReadonly<z.infer<typeof characterSchema>>;
export type PermanentContribution = DeepReadonly<z.infer<typeof permanentContributionSchema>>;
export type CreatureSize = (typeof CREATURE_SIZES)[number];
