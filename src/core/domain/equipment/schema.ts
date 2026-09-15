import { z } from "zod";

import { coinsSchema, NO_COINS, nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

export const MAXIMUM_ITEM_COUNT = 9999;

const moneySchema = coinsSchema;

const stockEntrySchema = z.object({
  itemId: nonEmpty,
  count: z.number().int().min(0).max(MAXIMUM_ITEM_COUNT).default(1),
});

const equipmentSchema = z
  .object({
    bag: z.array(stockEntrySchema).default([]),
    worn: z.array(stockEntrySchema).default([]),
    wanted: z.array(nonEmpty).default([]),

    money: moneySchema.default(NO_COINS),

    components: z.object({ componentPouch: z.boolean() }).optional(),
  })
  .default({
    bag: [],
    worn: [],
    wanted: [],
    money: NO_COINS,
  });

export function assertStockEntry(entry: unknown): void {
  parsedOrRefused(stockEntrySchema, entry, "запас вещи");
}

export function assertMoney(money: unknown): void {
  parsedOrRefused(moneySchema, money, "кошелёк");
}

export const EQUIPMENT_FIELDS = {
  equipment: equipmentSchema,
};

export type EquipmentData = DeepReadonly<z.infer<typeof equipmentSchema>>;
/** Счёт по каждой монете сам по себе: остаток кошелька бывает и отрицательным, а кошелёк — нет. */
export type Coins = Readonly<Record<keyof z.infer<typeof moneySchema>, number>>;

/**
 * Чего стоят покупки: цены сложены по каждой монете отдельно, потому что пересчёта между монетами
 * стол не делает; вещи без цены только сосчитаны, и в сумму им войти нечем.
 */
export type Shopping = {
  cost: Coins;
  rest: Coins;
  unpriced: number;
  short: boolean;
};
export type StockEntry = DeepReadonly<z.infer<typeof stockEntrySchema>>;
export type Money = DeepReadonly<z.infer<typeof moneySchema>>;

export function moneyOf(value: unknown): Money {
  return parsedOrRefused(moneySchema, value, "кошелёк");
}

