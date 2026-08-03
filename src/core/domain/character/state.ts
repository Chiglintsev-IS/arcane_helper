/**
 * Схемы состояния персонажа, активных эффектов, профиля отыгрыша и файла экспорта.
 *
 * Кросс-коллекционная целостность (ссылки на заклинания,
 * лимит подготовки) проверяется отдельно в integrity.ts: схема одного объекта её не видит.
 */

import { z } from "zod";

import { armorClassEffectSchema, MAXIMUM_SPELL_LEVEL } from "@/core/domain/catalog/spell";
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

const slotSchema = z
  .object({
    maximum: z.number().int().nonnegative(),
    remaining: z.number().int(),
  })
  .refine((slot) => slot.remaining <= slot.maximum, {
    message: "Осталось ячеек не может быть больше максимума",
    path: ["remaining"],
  });

/** Ключи — уровни ячеек 1…9 в строковом виде: JSON других ключей не знает. */
export const spellSlotsSchema = z.record(
  z.coerce.number().int().min(1).max(MAXIMUM_SPELL_LEVEL),
  slotSchema,
);

export const activeEffectSchema = z.object({
  id: nonEmpty,
  /** Отсутствует у эффекта, заведённого игроком вручную: статуса или чужого вклада в КД. */
  spellId: nonEmpty.optional(),
  nameRu: nonEmpty,

  type: z.enum(["buff", "control", "utility", "summon"]),
  startedAt: isoDateTime,

  duration: z.object({
    type: z.enum(["rounds", "minutes", "hours", "special"]),
    value: z.number().int().positive().optional(),
  }),

  isConcentration: z.boolean(),
  slotLevelUsed: z.number().int().min(0).max(MAXIMUM_SPELL_LEVEL),

  repeatableAction: z
    .object({ label: nonEmpty, description: nonEmpty })
    .optional(),

  // Копия вклада заклинания в КД: итог считается из одного состояния, без каталога.
  armorClass: armorClassEffectSchema.optional(),

  /**
   * Роль ручного эффекта, когда она есть: поправка к КД опознаётся этим признаком, а не строкой
   * имени — переименование подписи не имеет права ломать опознание.
   */
  manualKind: z.literal("armorAdjustment").optional(),

  endConditionRu: nonEmpty,
  note: nonEmpty.optional(),
});

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

    spellSlots: spellSlotsSchema,

    concentration: z
      .object({ spellId: nonEmpty, startedAt: isoDateTime })
      .optional(),

    activeEffects: z.array(activeEffectSchema),
    roleplayProfile: roleplayProfileSchema,

    /**
     * Дневной бюджет «Магического восстановления» уровнями ячеек: сколько всего и сколько осталось
     * до следующего долгого отдыха. За столом его берут частями — остаток может быть нулём без
     * долгого отдыха, а не только целиком доступен или целиком потрачен.
     */
    arcaneRecovery: z
      .object({
        maximum: z.number().int().nonnegative(),
        remaining: z.number().int().nonnegative(),
      })
      .refine((value) => value.remaining <= value.maximum, {
        message: "Бюджет магического восстановления не может остаться больше максимума",
        path: ["remaining"],
      }),
    /**
     * Был ли короткий отдых с последнего долгого.
     *
     * Необязательное намеренно: обязательное отвергло бы сохранения прежних версий, а обновление не
     * имеет права терять данные. `undefined` читается как «отдыха не было» — это честнее
     * молчаливого разрешения, а цена ошибки всего одно лишнее предупреждение.
     */
    shortRestSinceLongRest: z.boolean().optional(),

    runes: z
      .object({
        maximum: z.number().int().nonnegative(),
        remaining: z.number().int().nonnegative(),
      })
      .refine((value) => value.remaining <= value.maximum, {
        message: "Рун не может остаться больше максимума",
        path: ["remaining"],
      }),

    /**
     * Очки заклинаний: только остаток. Время создания схема не хранит — гасит их не срок, а любой
     * отмеченный час, независимо от того, когда они появились.
     */
    spellPoints: z.object({
      remaining: z.number().int().nonnegative(),
    }),

    ...EQUIPMENT_FIELDS,
    ...SPELLBOOK_FIELDS,
    ...VITALITY_FIELDS,
  })
  .superRefine((character, context) => {
    refineSpellbook(character, context);

    // Концентрация всегда сопровождается активным эффектом.
    if (character.concentration !== undefined) {
      const matching = character.activeEffects.find(
        (effect) => effect.isConcentration && effect.spellId === character.concentration?.spellId,
      );
      if (matching === undefined) {
        context.addIssue({
          code: "custom",
          path: ["activeEffects"],
          message: "Активная концентрация без соответствующего активного эффекта",
        });
      }
    }

    // Не более одного концентрационного эффекта одновременно.
    const concentrationEffects = character.activeEffects.filter((effect) => effect.isConcentration);
    if (concentrationEffects.length > 1) {
      context.addIssue({
        code: "custom",
        path: ["activeEffects"],
        message: `Одновременно активно ${concentrationEffects.length} концентрационных эффекта`,
      });
    }
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

export type SpellSlotsData = z.infer<typeof spellSlotsSchema>;
export type ActiveEffect = z.infer<typeof activeEffectSchema>;
export type RoleplayProfile = z.infer<typeof roleplayProfileSchema>;
// Пометки отыгрыша — поле книги заклинаний: тип живёт у владельца.
export type { RoleplayPreference };
// Кости хитов — поле жизнеспособности: тип живёт у владельца.
export type { HitDice };
export type CharacterState = z.infer<typeof characterStateSchema>;
