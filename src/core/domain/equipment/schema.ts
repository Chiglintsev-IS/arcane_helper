/**
 * Подсхема снаряжения: вещи по категориям, кошелёк и сведения о компонентах.
 *
 * Пределы и словари контекста объявляются в нём самом. Форма прибавок здесь не объявляется: она
 * общая у вещи и у прочих прибавок персонажа и потому живёт в основе.
 */

import { z } from "zod";

import { DomainError } from "@/core/domain/shared/errors";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

import { itemBonusesSchema, nonEmpty } from "@/core/domain/shared/schema";

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
const armorBase = z.number().int().positive();

const moneySchema = z.object({
  gold: coinAmount.default(0),
  silver: coinAmount.default(0),
  copper: coinAmount.default(0),
});

const NO_MONEY = { gold: 0, silver: 0, copper: 0 };

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
  armorBase: armorBase.optional(),
});

/**
 * Снаряжение: чем персонаж располагает вещественно.
 *
 * Числа отсюда, а не с листа персонажа: «+1 к магии» — свойство предмета, а не Торна. Поле со
 * значениями по умолчанию, а не обязательное: сохранение прежней версии обязано читаться.
 */
const equipmentSchema = z
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
  });

/**
 * Отвергает вещь или кошелёк, которые не проходят своих объявлений, — с причиной словами.
 *
 * Спрашивает те же схемы, которыми проверяется сохранённое состояние: числа вещи и монеты
 * проверяются в одном месте, а экран передаёт набранное как есть.
 */
export function assertInventoryItem(item: unknown): void {
  assertParsed(inventoryItemSchema.safeParse(item), "вещь");
}

export function assertMoney(money: unknown): void {
  assertParsed(moneySchema.safeParse(money), "кошелёк");
}

function assertParsed(result: z.ZodSafeParseResult<unknown>, subject: string): void {
  if (result.success) return;
  const reasons = result.error.issues
    .map((issue) => `поле «${issue.path.join(".")}»: ${issue.message}`)
    .join("; ");
  throw new DomainError(`Не годится ${subject} — ${reasons}`);
}

/** Поля контекста для сборки полной схемы состояния. */
export const EQUIPMENT_FIELDS = {
  equipment: equipmentSchema,
};

/** Данные снаряжения. Имя `Equipment` занято агрегатом: класс и его состояние — не одно и то же. */
export type EquipmentData = DeepReadonly<z.infer<typeof equipmentSchema>>;
export type InventoryItem = DeepReadonly<z.infer<typeof inventoryItemSchema>>;
export type ItemKind = (typeof ITEM_KINDS)[number];
export type Currency = (typeof CURRENCIES)[number];
export type Money = DeepReadonly<z.infer<typeof moneySchema>>;
