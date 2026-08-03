/**
 * Схемы состояния персонажа, активных эффектов, профиля отыгрыша и файла экспорта.
 *
 * Кросс-коллекционная целостность (ссылки на заклинания,
 * лимит подготовки) проверяется отдельно в integrity.ts: схема одного объекта её не видит.
 */

import { z } from "zod";

import { armorClassEffectSchema, MAXIMUM_SPELL_LEVEL } from "@/core/domain/catalog/spell";
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

/**
 * Категория вещи — четыре ответа на вопрос «что с этим делают»: экипировку надевают, расходник
 * тратят счётом, ингредиент копят под алхимию, остальное — «другое», пока стол не решил иначе.
 */
export const ITEM_KINDS = ["gear", "consumable", "ingredient", "other"] as const;

/** Монеты стола: золото, серебро, медь. Платину и электрум стол не использует — решение игрока. */
export const CURRENCIES = ["gold", "silver", "copper"] as const;

/** Верхний предел счёта вещи. Ноль — состояние, а не отсутствие: вещь с нулём остаётся в сумке. */
export const MAXIMUM_ITEM_COUNT = 9999;

/** Верхний предел одной монеты в кошельке. */
export const MAXIMUM_COIN_AMOUNT = 999_999;

const coinAmount = z.number().int().min(0).max(MAXIMUM_COIN_AMOUNT);

export const moneySchema = z.object({
  gold: coinAmount.default(0),
  silver: coinAmount.default(0),
  copper: coinAmount.default(0),
});

export const NO_MONEY = { gold: 0, silver: 0, copper: 0 };

/** Цена вещи. Необязательна: у находки из подземелья её может не назвать и мастер. */
const priceSchema = z.object({
  amount: z.number().int().min(0).max(MAXIMUM_COIN_AMOUNT),
  currency: z.enum(CURRENCIES),
});

/**
 * Вещь в инвентаре.
 *
 * Прибавка необязательна: большая часть вещей на числа не влияет, и нулевые поля у каждой верёвки
 * означали бы, что верёвка участвует в счёте Класса Доспеха.
 */
const inventoryItemSchema = z.object({
  id: nonEmpty,
  nameRu: nonEmpty,
  /** Категория без явного выбора — «другое»: неопознанную находку не заставляют классифицировать. */
  kind: z.enum(ITEM_KINDS).default("other"),
  /** Надето и потому действует. Лежащее в сумке к числам не прибавляется. */
  worn: z.boolean().default(false),
  /** Сколько экземпляров лежит вместе. Ноль остаётся в сумке: кончилось — не то же, что выброшено. */
  count: z.number().int().min(0).max(MAXIMUM_ITEM_COUNT).default(1),
  price: priceSchema.optional(),
  note: nonEmpty.optional(),
  bonuses: itemBonusesSchema.optional(),
  /**
   * База КД доспеха: у кольчуги 16, у кольца поля нет. База персонажа выводится из надетого —
   * наибольшая из баз, без доспеха действует база без доспехов.
   */
  armorBase: z.number().int().positive().optional(),
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

    /**
     * Снаряжение: чем персонаж располагает вещественно.
     *
     * Числа отсюда, а не с листа персонажа: «+1 к магии» — свойство предмета, а не Торна. Поле со
     * значениями по умолчанию, а не обязательное: сохранение прежней версии обязано читаться.
     */
    equipment: z
      .object({
        items: z.array(inventoryItemSchema).default([]),

        /** Кошелёк. Со значениями по умолчанию: сохранение прежней версии денег не знало. */
        money: moneySchema.default(NO_MONEY),

        /**
         * Сведения о компонентах. Необязательные: отсутствие записи — не пустая сумка, а незнание,
         * и вердикта о компонентах в этом случае нет вовсе.
         */
        components: z
          .object({
            spellcastingFocus: z.boolean(),
            componentPouch: z.boolean(),
            /** Идентификаторы заклинаний, чей дорогой компонент есть в сумке. */
            materialsForSpellIds: z.array(nonEmpty),
          })
          .optional(),
      })
      .default({
        items: [],
        money: NO_MONEY,
      }),

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

export type InventoryItem = z.infer<typeof inventoryItemSchema>;
// Форма прибавок живёт в общем ядре: она общая у вещи и у прочих прибавок персонажа.
export type { ItemBonuses };
export type ItemKind = (typeof ITEM_KINDS)[number];
export type ItemPrice = NonNullable<InventoryItem["price"]>;
export type Currency = (typeof CURRENCIES)[number];
export type Money = z.infer<typeof moneySchema>;
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
export type Equipment = z.infer<typeof characterStateSchema>["equipment"];
export type CharacterState = z.infer<typeof characterStateSchema>;
