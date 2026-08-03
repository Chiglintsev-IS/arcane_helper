/**
 * Схемы состояния персонажа, активных эффектов, профиля отыгрыша и файла экспорта.
 *
 * Кросс-коллекционная целостность (ссылки на заклинания,
 * лимит подготовки) проверяется отдельно в integrity.ts: схема одного объекта её не видит.
 */

import { z } from "zod";

import { ARCANA_FIELDS, spellSlotsSchema, type SpellSlotsData } from "@/core/domain/arcana/schema";
import {
  activeEffectSchema,
  EFFECTS_FIELDS,
  refineEffects,
  type ActiveEffect,
} from "@/core/domain/effects/schema";
import {
  CURRENCIES,
  EQUIPMENT_FIELDS,
  ITEM_KINDS,
  MAXIMUM_COIN_AMOUNT,
  MAXIMUM_ITEM_COUNT,
  moneySchema,
  NO_MONEY,
  type Currency,
  type EquipmentData,
  type InventoryItem,
  type ItemKind,
  type ItemPrice,
  type Money,
} from "@/core/domain/equipment/schema";
import {
  refineSpellbook,
  SPELLBOOK_FIELDS,
  type RoleplayPreference,
} from "@/core/domain/spellbook/schema";
import { VITALITY_FIELDS, type HitDice } from "@/core/domain/vitality/schema";
import {
  isoDateTime,
  itemBonusesSchema,
  nonEmpty,
  NO_ITEM_BONUSES,
  type ItemBonuses,
} from "@/core/domain/shared/schema";

import { ABILITIES, SKILL_IDS, SKILL_TRAINING } from "./skills";

/** Версия формата экспорта. Файл неизвестной версии отклоняется, прежний — приводится. */
export const EXPORT_SCHEMA_VERSION = 6;

export const roleplayProfileSchema = z.object({
  tone: z.array(z.enum(["serious", "mysterious", "sarcastic", "wild"])).min(1),
  magicThemes: z.array(nonEmpty),
  speechStyle: nonEmpty,
  gestureStyle: nonEmpty,
  preferredElements: z.array(nonEmpty),
  prohibitedThemes: z.array(nonEmpty),
  maximumPhraseLength: z.number().int().positive(),
});

const abilityScore = z.number().int().min(1).max(30);

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

const overridesSchema = z
  .object({
    proficiencyBonus: z.number().int().optional(),
    spellSaveDc: z.number().int().optional(),
    spellAttackModifier: z.number().int().optional(),
    preparedLimit: z.number().int().positive().optional(),
    initiative: z.number().int().optional(),
    passivePerception: z.number().int().optional(),
    /** Перебивка базы КД: действует вместо выведенной из надетого доспеха. */
    armorClassBase: z.number().int().positive().optional(),
    saves: z.partialRecord(z.enum(ABILITIES), z.number().int()).default({}),
    skills: z.partialRecord(z.enum(SKILL_IDS), z.number().int()).default({}),
  })
  .default({ saves: {}, skills: {} });

export const characterStateSchema = z
  .object({
    id: nonEmpty,
    name: nonEmpty,
    className: nonEmpty,
    level: z.number().int().min(1).max(20),

    /**
     * Справочные поля листа. Со значением по умолчанию, а не обязательные: сохранение, сделанное до
     * появления листа, обязано читаться — обновление не имеет права терять данные.
     */
    species: nonEmpty.or(z.literal("")).default(""),
    subclass: nonEmpty.or(z.literal("")).default(""),
    age: z.number().int().nonnegative().default(0),
    size: z.enum(CREATURE_SIZES).default("medium"),
    speed: z.number().int().nonnegative().default(30),

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

    exhaustion: z.number().int().min(0).max(6).default(0),
    inspiration: z.boolean().default(false),

    roleplayProfile: roleplayProfileSchema,

    ...ARCANA_FIELDS,
    ...EFFECTS_FIELDS,
    ...EQUIPMENT_FIELDS,
    ...SPELLBOOK_FIELDS,
    ...VITALITY_FIELDS,
  })
  .superRefine((character, context) => {
    refineSpellbook(character, context);
    refineEffects(character, context);
  });

export const exportFileSchema = z.object({
  schemaVersion: z.literal(EXPORT_SCHEMA_VERSION),
  exportedAt: isoDateTime,
  character: characterStateSchema,
  spells: z.array(z.unknown()),
});

/**
 * Поля, не попадающие в снимок отмены: справочные записи листа и состояние интерфейса. Их правка
 * ничего не расходует, и возвращать их журналом было бы нечего.
 */
const UNRECORDED_KEYS = [
  "id",
  "name",
  "className",
  "species",
  "subclass",
  "age",
  "size",
  "speed",
  "proficiencies",
  "roleplayProfile",
] as const satisfies readonly (keyof CharacterStateShape)[];

/**
 * Поля, попадающие в снимок отмены: всё, кроме справочных.
 *
 * Выводится вычитанием, а не перечисляется руками. Ручной список требовал бы помнить про него при
 * каждом новом ресурсе, и забытая строка молча оставляла бы ресурс потраченным после отмены.
 */
export const MUTABLE_STATE_KEYS = (
  Object.keys(characterStateSchema.shape) as (keyof CharacterStateShape)[]
).filter((key) => !(UNRECORDED_KEYS as readonly string[]).includes(key));

type CharacterStateShape = z.infer<typeof characterStateSchema>;

// Форма прибавок живёт в общем ядре: она общая у вещи и у прочих прибавок персонажа.
export type { ItemBonuses };
// Словари и пределы снаряжения на переходный период отдаются отсюда: потребители вне домена
// переезжают на владельца вместе с разбором общей схемы.
export { CURRENCIES, ITEM_KINDS, MAXIMUM_COIN_AMOUNT, MAXIMUM_ITEM_COUNT, moneySchema, NO_MONEY };
// Вещи, деньги и цена — поля снаряжения: типы живут у владельца. Имя `Equipment` осталось прежним
// для потребителей вне домена, данными же владеет `EquipmentData`.
export type {
  Currency,
  EquipmentData,
  EquipmentData as Equipment,
  InventoryItem,
  ItemKind,
  ItemPrice,
  Money,
};
export type CreatureSize = (typeof CREATURE_SIZES)[number];
export type Abilities = z.infer<typeof abilitiesSchema>;
export type Overrides = z.infer<typeof overridesSchema>;

// Ячейки — поле магических ресурсов: схема и тип живут у владельца.
export { spellSlotsSchema };
export type { SpellSlotsData };
// Активный эффект — поле доски эффектов: схема и тип живут у владельца.
export { activeEffectSchema };
export type { ActiveEffect };
export type RoleplayProfile = z.infer<typeof roleplayProfileSchema>;
// Пометки отыгрыша — поле книги заклинаний: тип живёт у владельца.
export type { RoleplayPreference };
// Кости хитов — поле жизнеспособности: тип живёт у владельца.
export type { HitDice };
export type CharacterState = z.infer<typeof characterStateSchema>;
