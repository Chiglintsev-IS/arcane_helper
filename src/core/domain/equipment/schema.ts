/**
 * Подсхема снаряжения: сколько вещи лежит в сумке и сколько надето, кошелёк, сведения о компонентах.
 *
 * Природу вещи — категорию, прибавки, базу доспеха, цену — снаряжение не хранит: она у контекста
 * «Вещи», а здесь только счёт по месту. Сумка и надетое — два независимых счёта одной и той же
 * вещи, а не флаг поверх одного счёта: десять одинаковых колец можно носить три, а семь держать в
 * сумке одновременно.
 */

import { z } from "zod";

import { nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

/** Верхний предел счёта вещи в одном месте. Ноль — состояние, а не отсутствие записи. */
export const MAXIMUM_ITEM_COUNT = 9999;

/** Верхний предел одной монеты в кошельке. */
const MAXIMUM_COIN_AMOUNT = 999_999;

const coinAmount = z.number().int().min(0).max(MAXIMUM_COIN_AMOUNT);

const moneySchema = z.object({
  gold: coinAmount.default(0),
  silver: coinAmount.default(0),
  copper: coinAmount.default(0),
});

const NO_MONEY = { gold: 0, silver: 0, copper: 0 };

/** Счёт вещи в одном месте: сколько её там лежит, по её id, а не по её природе. */
const stockEntrySchema = z.object({
  itemId: nonEmpty,
  count: z.number().int().min(0).max(MAXIMUM_ITEM_COUNT).default(1),
});

/**
 * Снаряжение: чем персонаж располагает вещественно — сколько чего в сумке и сколько надето.
 *
 * Числа отсюда, а не с листа персонажа: «+1 к магии» — свойство надетого предмета, а не Торна.
 * Поле со значениями по умолчанию, а не обязательное: сохранение прежней версии обязано читаться.
 */
const equipmentSchema = z
  .object({
    bag: z.array(stockEntrySchema).default([]),
    worn: z.array(stockEntrySchema).default([]),

    /** Кошелёк. Со значениями по умолчанию: сохранение прежней версии денег не знало. */
    money: moneySchema.default(NO_MONEY),

    /**
     * Сведения о компонентах. Необязательные: отсутствие записи — не пустая сумка, а незнание,
     * и вердикта о компонентах в этом случае нет вовсе.
     *
     * Самих компонентов здесь нет: материал — вещь, и лежит он в сумке своим запасом.
     */
    components: z.object({ componentPouch: z.boolean() }).optional(),
  })
  .default({
    bag: [],
    worn: [],
    money: NO_MONEY,
  });

/**
 * Отвергает запись запаса или кошелёк, не прошедшие своих объявлений, — с причиной словами.
 *
 * Спрашивают те же схемы, которыми проверяется сохранённое состояние: числа запаса и монеты
 * проверяются в одном месте, а экран передаёт набранное как есть.
 */
export function assertStockEntry(entry: unknown): void {
  parsedOrRefused(stockEntrySchema, entry, "запас вещи");
}

export function assertMoney(money: unknown): void {
  parsedOrRefused(moneySchema, money, "кошелёк");
}

/** Поля контекста для сборки полной схемы состояния. */
export const EQUIPMENT_FIELDS = {
  equipment: equipmentSchema,
};

/** Данные снаряжения. Имя `Equipment` занято объектом-значением: класс и его состояние — не одно и то же. */
export type EquipmentData = DeepReadonly<z.infer<typeof equipmentSchema>>;
export type StockEntry = DeepReadonly<z.infer<typeof stockEntrySchema>>;
export type Money = DeepReadonly<z.infer<typeof moneySchema>>;

/**
 * Кошелёк из сообщения снаружи: объявление проверяет его само и отказывает с причиной.
 *
 * Наружу отдаётся сужение, а не схема: пусти схему за границу, и её начнут расширять на месте, а
 * объявление кошелька перестанет быть одним.
 */
export function moneyOf(value: unknown): Money {
  return parsedOrRefused(moneySchema, value, "кошелёк");
}

