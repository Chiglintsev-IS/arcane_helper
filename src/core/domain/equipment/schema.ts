import { z } from "zod";

import { nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";

import type { DeepReadonly } from "@/core/domain/shared/readonly";

export const MAXIMUM_ITEM_COUNT = 9999;

const MAXIMUM_COIN_AMOUNT = 999_999;

const coinAmount = z.number().int().min(0).max(MAXIMUM_COIN_AMOUNT);

const moneySchema = z.object({
  gold: coinAmount.default(0),
  silver: coinAmount.default(0),
  copper: coinAmount.default(0),
});

const NO_MONEY = { gold: 0, silver: 0, copper: 0 };

const stockEntrySchema = z.object({
  itemId: nonEmpty,
  count: z.number().int().min(0).max(MAXIMUM_ITEM_COUNT).default(1),
});

const equipmentSchema = z
  .object({
    bag: z.array(stockEntrySchema).default([]),
    worn: z.array(stockEntrySchema).default([]),
    wanted: z.array(nonEmpty).default([]),

    money: moneySchema.default(NO_MONEY),

    components: z.object({ componentPouch: z.boolean() }).optional(),
  })
  .default({
    bag: [],
    worn: [],
    wanted: [],
    money: NO_MONEY,
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
export type StockEntry = DeepReadonly<z.infer<typeof stockEntrySchema>>;
export type Money = DeepReadonly<z.infer<typeof moneySchema>>;

export function moneyOf(value: unknown): Money {
  return parsedOrRefused(moneySchema, value, "кошелёк");
}

