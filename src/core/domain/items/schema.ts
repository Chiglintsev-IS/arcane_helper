import { z } from "zod";

import { CURRENCIES, nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import { statBonusesSchema } from "@/core/domain/shared/stats";
import type { DeepReadonly } from "@/core/domain/shared/readonly";

export const ITEM_KINDS = ["gear", "consumable", "ingredient"] as const;

const MAXIMUM_COIN_AMOUNT = 999_999;

const priceSchema = z.object({
  amount: z.number().int().min(0).max(MAXIMUM_COIN_AMOUNT),
  currency: z.enum(CURRENCIES),
});

function wearableOnlyRefusal(nameRu: string): string {
  return `«${nameRu}» не экипировка: доспеха и фокусировки у неё не бывает`;
}

export function notWearableRefusal(nameRu: string): string {
  return `«${nameRu}» не экипировка: её не надевают`;
}

function carriedBonusRefusal(nameRu: string): string {
  return `«${nameRu}» не экипировка: её прибавка действует при себе`;
}

const itemDefinitionFields = z.object({
  id: nonEmpty,
  nameRu: nonEmpty,
  kinds: z.array(z.enum(ITEM_KINDS)).default([]),
  price: priceSchema.optional(),
  note: nonEmpty.optional(),
  bonuses: statBonusesSchema.optional(),
  worksCarried: z.literal(true).optional(),
  spellcastingFocus: z.literal(true).optional(),
});

type ItemFields = z.infer<typeof itemDefinitionFields>;

const WEARABLE_ONLY_FIELDS = ["spellcastingFocus"] as const satisfies readonly (keyof ItemFields)[];

export function filledWearableOnlyFields(
  item: Readonly<Record<string, unknown>>,
): readonly string[] {
  return WEARABLE_ONLY_FIELDS.filter((field) => item[field] !== undefined);
}

export function withoutWearableOnlyFields(
  item: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...item };
  for (const field of WEARABLE_ONLY_FIELDS) delete rest[field];
  return rest;
}

function withoutEmptyBonuses(item: ItemFields): ItemFields {
  const { bonuses, ...rest } = item;
  if (bonuses === undefined) return item;
  const contributing = Object.entries(bonuses).filter(([, value]) => value !== 0);
  return contributing.length === 0 ? rest : { ...rest, bonuses: Object.fromEntries(contributing) };
}

function withoutIdleCondition(item: ItemFields): ItemFields {
  if (item.bonuses !== undefined || item.worksCarried === undefined) return item;
  const { worksCarried: _idle, ...rest } = item;
  return rest;
}

function withOrderedKinds(item: ItemFields): ItemFields {
  return { ...item, kinds: ITEM_KINDS.filter((kind) => item.kinds.includes(kind)) };
}

function isWearable(item: { readonly kinds: readonly string[] }): boolean {
  return item.kinds.includes("gear");
}

const itemDefinitionSchema = itemDefinitionFields
  .transform(withOrderedKinds)
  .transform(withoutEmptyBonuses)
  .transform(withoutIdleCondition)
  .superRefine((item, context) => {
    if (!isWearable(item)) {
      for (const field of filledWearableOnlyFields(item)) {
        context.addIssue({ code: "custom", path: [field], message: wearableOnlyRefusal(item.nameRu) });
      }
      if (item.bonuses !== undefined && item.worksCarried !== true) {
        context.addIssue({
          code: "custom",
          path: ["worksCarried"],
          message: carriedBonusRefusal(item.nameRu),
        });
      }
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

export function wearable(item: ItemDefinition): boolean {
  return isWearable(item);
}

export function countedCarried(item: ItemDefinition): boolean {
  return item.worksCarried === true;
}

export function alignedItemDefinition(item: ItemDefinition): ItemDefinition {
  const aligned = wearable(item)
    ? item
    : {
        ...withoutWearableOnlyFields(item),
        ...(item.bonuses === undefined ? {} : { worksCarried: true }),
      };
  return parsedOrRefused(itemDefinitionSchema, aligned, "вещь");
}

export const ITEMS_FIELDS = {
  itemDefinitions: z.array(itemDefinitionSchema).default([]),
};
