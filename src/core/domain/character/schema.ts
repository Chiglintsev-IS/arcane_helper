/**
 * Подсхема персонажа: кто он сам по себе.
 *
 * Здесь только то, что принадлежит самому Торну, — уровень, характеристики, владения, отметки и
 * профиль отыгрыша. Ресурсы, здоровье, вещи, книга и эффекты объявлены в своих контекстах, а полное
 * состояние собирает сборка.
 */

import { z } from "zod";

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
const positiveOverride = z.number().int().positive();

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
