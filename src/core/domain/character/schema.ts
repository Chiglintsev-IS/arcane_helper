/**
 * Подсхема персонажа: кто он сам по себе.
 *
 * Здесь только то, что принадлежит самому Торну, — уровень, характеристики, владения, отметки и
 * профиль отыгрыша. Ресурсы, здоровье, вещи, книга и эффекты объявлены в своих контекстах, а полное
 * состояние собирает сборка.
 */

import { z } from "zod";

import { DomainError } from "@/core/domain/shared/errors";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import {
  MAXIMUM_ABILITY_SCORE,
  MAXIMUM_EXHAUSTION,
  MINIMUM_ABILITY_SCORE,
} from "@/core/domain/character/abilities";
import { itemBonusesSchema, nonEmpty, NO_ITEM_BONUSES } from "@/core/domain/shared/schema";

import { ABILITIES, SKILL_IDS, SKILL_TRAINING } from "./skills";

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
const abilityScore = z.number().int().min(MINIMUM_ABILITY_SCORE).max(MAXIMUM_ABILITY_SCORE);
const characterLevel = z
  .number()
  .int()
  .min(MINIMUM_CHARACTER_LEVEL)
  .max(MAXIMUM_CHARACTER_LEVEL);
const age = z.number().int().nonnegative();
const speedFeet = z.number().int().nonnegative();
const overrideValue = z.number().int();
const positiveOverride = z.number().refine((value) => Number.isInteger(value) && value > 0, {
  message: "Перебивка должна быть целым положительным числом",
});

/** Размер существа: из перечисления правил, потому что от него зависят правила захвата и укрытия. */
export const CREATURE_SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;

const abilitiesSchema = z.object({
  strength: abilityScore,
  dexterity: abilityScore,
  constitution: abilityScore,
  intelligence: abilityScore,
  wisdom: abilityScore,
  charisma: abilityScore,
});

/**
 * Перебивки производных чисел.
 *
 * Хранит их персонаж, а считает лист: введённое руками — свойство этого Торна, а не формулы. Ребра к
 * листу отсюда нет и быть не должно — перебивка знает только своё число.
 */
const overridesSchema = z
  .object({
    proficiencyBonus: overrideValue.optional(),
    spellSaveDc: overrideValue.optional(),
    spellAttackModifier: overrideValue.optional(),
    preparedLimit: positiveOverride.optional(),
    initiative: overrideValue.optional(),
    passivePerception: overrideValue.optional(),
    /** Перебивка базы КД: действует вместо выведенной из надетого доспеха. */
    armorClassBase: positiveOverride.optional(),
    saves: z.partialRecord(z.enum(ABILITIES), overrideValue).default({}),
    skills: z.partialRecord(z.enum(SKILL_IDS), overrideValue).default({}),
  })
  .default({ saves: {}, skills: {} });

/** Бывает ли такой уровень: отвечает то же объявление, которым проверяется состояние. */
export function isPossibleCharacterLevel(level: number): boolean {
  return characterLevel.safeParse(level).success;
}

/**
 * Отвергает правку, которая не проходит объявления полей, — с причиной словами; принятую возвращает
 * разобранной.
 *
 * Проверяет ровно те поля, что пришли: значение по умолчанию отсутствующего поля правкой не является.
 * Возвращённый патч несёт те же ключи, но со значениями после умолчаний поля — записывать в
 * состояние положено его, а не сырой ввод: умолчания, дописанные разбором, иначе оседают в
 * отброшенном результате, а не в персонаже. Другого места, где эти числа проверяются, нет: экран
 * передаёт набранное как есть и получает либо новое состояние, либо отказ.
 */
export function assertCharacterFields(
  patch: Partial<Record<keyof typeof CHARACTER_FIELDS, unknown>>,
): Partial<CharacterFields> {
  const parsedPatch: Partial<Record<keyof typeof CHARACTER_FIELDS, unknown>> = {};
  for (const [key, value] of Object.entries(patch)) {
    const field = key as keyof typeof CHARACTER_FIELDS;
    const parsed = CHARACTER_FIELDS[field].safeParse(value);
    if (!parsed.success) {
      throw new DomainError(`Поле «${key}» не годится: ${reasonsOf(parsed.error)}`);
    }
    parsedPatch[field] = parsed.data;
  }
  return parsedPatch as Partial<CharacterFields>;
}

/** Причины отказа словами: их называет само объявление поля. */
function reasonsOf(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

/** Поля контекста для сборки полной схемы состояния. */
export const CHARACTER_FIELDS = {
  id: nonEmpty,
  name: nonEmpty,
  className: nonEmpty,
  level: characterLevel,

  /**
   * Справочные поля листа. Со значением по умолчанию, а не обязательные: сохранение, сделанное до
   * появления листа, обязано читаться — обновление не имеет права терять данные.
   */
  species: nonEmpty.or(z.literal("")).default(""),
  subclass: nonEmpty.or(z.literal("")).default(""),
  age: age.default(0),
  size: z.enum(CREATURE_SIZES).default("medium"),
  speed: speedFeet.default(30),

  abilities: abilitiesSchema,
  saveProficiencies: z.array(z.enum(ABILITIES)).default([]),
  skills: z.partialRecord(z.enum(SKILL_IDS), z.enum(SKILL_TRAINING)).default({}),
  proficiencies: z
    .object({
      weapons: z.array(nonEmpty).default([]),
      armor: z.array(nonEmpty).default([]),
      tools: z.array(nonEmpty).default([]),
      languages: z.array(nonEmpty).default([]),
    })
    .default({ weapons: [], armor: [], tools: [], languages: [] }),

  overrides: overridesSchema,

  /**
   * Прочие прибавки — свойство самого персонажа: благословение, дар, обучение. Прибавка,
   * привязанная к вещи, живёт у вещи в снаряжении; сюда идёт та, у которой вещи нет.
   */
  miscBonuses: itemBonusesSchema.default(NO_ITEM_BONUSES),

  /** Отметки на листе: их ставят и снимают там же, где смотрят, — на «Листе». */
  exhaustion: z.number().int().min(0).max(MAXIMUM_EXHAUSTION).default(0),
  inspiration: z.boolean().default(false),

  roleplayProfile: roleplayProfileSchema,
};

const characterSchema = z.object(CHARACTER_FIELDS);

export type CharacterFields = DeepReadonly<z.infer<typeof characterSchema>>;
export type CreatureSize = (typeof CREATURE_SIZES)[number];
