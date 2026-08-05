/**
 * Подсхема вещей: природа предмета — без места, где он лежит, и без счёта.
 *
 * Пределы и словари контекста объявляются в нём самом. Форма прибавок здесь не объявляется: она
 * общая у вещи и у прочих прибавок персонажа и потому живёт в основе.
 */

import { z } from "zod";

import { CURRENCIES, itemBonusesSchema, nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import type { DeepReadonly } from "@/core/domain/shared/readonly";

/**
 * Категория вещи — четыре ответа на вопрос «что с этим делают»: экипировку надевают, расходник
 * тратят счётом, ингредиент копят под алхимию, остальное — «другое», пока стол не решил иначе.
 */
export const ITEM_KINDS = ["gear", "consumable", "ingredient", "other"] as const;

/** Верхний предел одной монеты цены. */
const MAXIMUM_COIN_AMOUNT = 999_999;

const armorBase = z.number().int().positive();

/** Цена вещи. Необязательна: у находки из подземелья её может не назвать и мастер. */
const priceSchema = z.object({
  amount: z.number().int().min(0).max(MAXIMUM_COIN_AMOUNT),
  currency: z.enum(CURRENCIES),
});

/**
 * Отказ хранить прибавки и базу доспеха не у экипировки.
 *
 * Одна фраза у объявления вещи и у правки её категории: копия разошлась бы с оригиналом на первой
 * же правке, и молча.
 */
export function gearOnlyRefusal(nameRu: string): string {
  return `«${nameRu}» не экипировка: прибавок и базы доспеха у неё не бывает`;
}

/**
 * Вещь: что она такое, а не сколько её у персонажа и где она лежит — это факты снаряжения.
 *
 * Прибавка необязательна: большая часть вещей на числа не влияет, и нулевые поля у каждой верёвки
 * означали бы, что верёвка участвует в счёте Класса Доспеха.
 */
const itemDefinitionFields = z.object({
  id: nonEmpty,
  nameRu: nonEmpty,
  /** Категория без явного выбора — «другое»: неопознанную находку не заставляют классифицировать. */
  kind: z.enum(ITEM_KINDS).default("other"),
  price: priceSchema.optional(),
  note: nonEmpty.optional(),
  bonuses: itemBonusesSchema.optional(),
  /**
   * База КД доспеха: у кольчуги 16, у кольца поля нет. База персонажа выводится из надетого —
   * наибольшая из баз, без доспеха действует база без доспехов.
   */
  armorBase: armorBase.optional(),
});

type ItemFields = z.infer<typeof itemDefinitionFields>;

/**
 * Свойства экипировки — каждое со своим снятым видом: отсутствием поля.
 *
 * Список один на всё ядро: по нему объявление отказывает чужой категории, по нему же правка вещи
 * эти свойства снимает. Второе перечисление разошлось бы с первым молча — и вещь, где новое
 * свойство лежит у расходника, перестала бы проходить объявление целиком.
 */
const GEAR_ONLY_FIELDS = [
  ["bonuses", undefined],
  ["armorBase", undefined],
] as const satisfies readonly (readonly [keyof ItemFields, unknown])[];

/** Свойства экипировки, заполненные у вещи: значение в снятом виде заполненным не считается. */
export function filledGearOnlyFields(item: Readonly<Record<string, unknown>>): readonly string[] {
  return GEAR_ONLY_FIELDS.filter(
    ([field, cleared]) => item[field] !== cleared && item[field] !== undefined,
  ).map(([field]) => field);
}

/** Та же вещь со снятыми свойствами экипировки: у прочих категорий их не бывает. */
export function withoutGearOnlyFields(
  item: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...item };
  for (const [field, cleared] of GEAR_ONLY_FIELDS) {
    if (cleared === undefined) delete rest[field];
    else rest[field] = cleared;
  }
  return rest;
}

const itemDefinitionSchema = itemDefinitionFields.superRefine((item, context) => {
  if (item.kind === "gear") return;
  for (const field of filledGearOnlyFields(item)) {
    context.addIssue({ code: "custom", path: [field], message: gearOnlyRefusal(item.nameRu) });
  }
});

export type ItemDefinition = DeepReadonly<z.infer<typeof itemDefinitionSchema>>;
export type ItemKind = (typeof ITEM_KINDS)[number];
export type Price = DeepReadonly<z.infer<typeof priceSchema>>;

export function assertItemDefinition(item: unknown): void {
  parsedOrRefused(itemDefinitionSchema, item, "вещь");
}

/**
 * Вещь, годная к хранению: приведённая к своей категории и проверенная объявлением.
 *
 * Свойства экипировки вне экипировки снимаются, а не отвергают правку: игрок переложил зелье в свой
 * раздел, а не ошибся полем. Остальное объявление действует как обычно, и отказ называет причину.
 */
export function alignedItemDefinition(item: ItemDefinition): ItemDefinition {
  const aligned = item.kind === "gear" ? item : withoutGearOnlyFields(item);
  return parsedOrRefused(itemDefinitionSchema, aligned, "вещь");
}

/**
 * Прибавка из одних нулей не хранится вовсе: верёвка не участвует в счёте Класса Доспеха.
 */
export function withoutEmptyBonuses(item: ItemDefinition): ItemDefinition {
  const { bonuses, ...rest } = item;
  const contributes = bonuses !== undefined && Object.values(bonuses).some((value) => value !== 0);
  return contributes ? item : rest;
}

/** Поля контекста для сборки полной схемы состояния. */
export const ITEMS_FIELDS = {
  itemDefinitions: z.array(itemDefinitionSchema).default([]),
};
