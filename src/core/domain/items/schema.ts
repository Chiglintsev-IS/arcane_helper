import { z } from "zod";

import { CURRENCIES, nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import { ARMOR_CATEGORIES, statBonusesSchema } from "@/core/domain/shared/stats";
import type { DeepReadonly } from "@/core/domain/shared/readonly";

export const ITEM_KINDS = ["gear", "consumable", "ingredient", "other"] as const;

const MAXIMUM_COIN_AMOUNT = 999_999;

const armorSchema = z.object({
  base: z.number().int().positive(),
  category: z.enum(ARMOR_CATEGORIES).optional(),
});

const priceSchema = z.object({
  amount: z.number().int().min(0).max(MAXIMUM_COIN_AMOUNT),
  currency: z.enum(CURRENCIES),
});

export function gearOnlyRefusal(nameRu: string): string {
  return `«${nameRu}» не экипировка: прибавок и базы доспеха у неё не бывает`;
}

const itemDefinitionFields = z.object({
  id: nonEmpty,
  nameRu: nonEmpty,
  kind: z.enum(ITEM_KINDS).default("other"),
  price: priceSchema.optional(),
  note: nonEmpty.optional(),
  bonuses: statBonusesSchema.optional(),
  armor: armorSchema.optional(),
  spellcastingFocus: z.literal(true).optional(),
});

type ItemFields = z.infer<typeof itemDefinitionFields>;

const GEAR_ONLY_FIELDS = [
  "bonuses",
  "armor",
  "spellcastingFocus",
] as const satisfies readonly (keyof ItemFields)[];

export function filledGearOnlyFields(item: Readonly<Record<string, unknown>>): readonly string[] {
  return GEAR_ONLY_FIELDS.filter((field) => item[field] !== undefined);
}

export function withoutGearOnlyFields(
  item: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...item };
  for (const field of GEAR_ONLY_FIELDS) delete rest[field];
  return rest;
}

function withoutEmptyBonuses(item: ItemFields): ItemFields {
  const { bonuses, ...rest } = item;
  if (bonuses === undefined) return item;
  const contributing = Object.entries(bonuses).filter(([, value]) => value !== 0);
  return contributing.length === 0 ? rest : { ...rest, bonuses: Object.fromEntries(contributing) };
}

const itemDefinitionSchema = itemDefinitionFields
  .transform(withoutEmptyBonuses)
  .superRefine((item, context) => {
    if (item.kind === "gear") return;
    for (const field of filledGearOnlyFields(item)) {
      context.addIssue({ code: "custom", path: [field], message: gearOnlyRefusal(item.nameRu) });
    }
  });

export type ItemDefinition = DeepReadonly<z.infer<typeof itemDefinitionSchema>>;
export type ItemKind = (typeof ITEM_KINDS)[number];

export function assertItemDefinition(item: unknown): void {
  parsedOrRefused(itemDefinitionSchema, item, "вещь");
}

export function itemDefinitionOf(value: unknown): ItemDefinition {
  return parsedOrRefused(itemDefinitionSchema, value, "вещь");
}

export function alignedItemDefinition(item: ItemDefinition): ItemDefinition {
  const aligned = item.kind === "gear" ? item : withoutGearOnlyFields(item);
  return parsedOrRefused(itemDefinitionSchema, aligned, "вещь");
}

export const ITEMS_FIELDS = {
  itemDefinitions: z.array(itemDefinitionSchema).default([]),
};
