import { z } from "zod";

import { ingredientAlchemySchema } from "@/core/domain/items/ingredient";
import { CURRENCIES, coinsSchema, nonEmpty, parsedOrRefused } from "@/core/domain/shared/schema";
import { statBonusesSchema } from "@/core/domain/shared/stats";
import type { DeepReadonly } from "@/core/domain/shared/readonly";

/**
 * Признаки, которые ставят рукой: экипировку надевают, безделушка действует при себе. Ингредиента
 * среди них нет: вещь становится видом алхимии, когда о ней записано алхимическое знание, — пометкой
 * этого не объявляют и снятием пометки не отменяют. Расходника тоже нет: тратят счётом всякую вещь,
 * и признак, ничего не меняющий, отличал бы одно от другого только на словах.
 */
export const ITEM_KINDS = ["gear", "trinket"] as const;

const GEAR = "gear";

const TRINKET = "trinket";

function wearableOnlyRefusal(nameRu: string): string {
  return `«${nameRu}» не экипировка: доспеха и фокусировки у неё не бывает`;
}

export function noteTakenRefusal(id: string): string {
  return `заметка «${id}» у этой вещи уже записана`;
}

export function noteMissingRefusal(nameRu: string, id: string): string {
  return `у вещи «${nameRu}» нет заметки «${id}»`;
}

export function nameTakenRefusal(nameRu: string): string {
  return `«${nameRu}» уже заведена: двух вещей с одним именем не бывает`;
}

export function notWearableRefusal(nameRu: string): string {
  return `«${nameRu}» не экипировка: её не надевают`;
}

function idleBonusRefusal(nameRu: string): string {
  return `«${nameRu}» не экипировка и не безделушка: её прибавке негде действовать`;
}

export function trinketKeptRefusal(nameRu: string): string {
  return `Вещь «${nameRu}» остаётся безделушкой: она не экипировка, и её прибавки действуют только при себе. Сначала отметьте экипировку или уберите прибавки.`;
}

/** Слова о вещи приходят по одной и живут поодиночке: потому у каждой своя запись, а не абзац. */
const noteFields = z.object({
  id: nonEmpty,
  textRu: nonEmpty,
});

const itemDefinitionFields = z.object({
  id: nonEmpty,
  nameRu: nonEmpty,
  kinds: z.array(z.enum(ITEM_KINDS)).default([]),
  price: coinsSchema.optional(),
  notes: z.array(noteFields).default([]),
  bonuses: statBonusesSchema.optional(),
  spellcastingFocus: z.literal(true).optional(),
  alchemy: ingredientAlchemySchema.optional(),
});

type ItemFields = z.infer<typeof itemDefinitionFields>;

const WEARABLE_ONLY_FIELDS = ["spellcastingFocus"] as const satisfies readonly (keyof ItemFields)[];

function filledFields(
  item: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): readonly string[] {
  return fields.filter((field) => item[field] !== undefined);
}

function withoutFields(
  item: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...item };
  for (const field of fields) delete rest[field];
  return rest;
}

export function filledWearableOnlyFields(
  item: Readonly<Record<string, unknown>>,
): readonly string[] {
  return filledFields(item, WEARABLE_ONLY_FIELDS);
}

export function withoutWearableOnlyFields(
  item: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return withoutFields(item, WEARABLE_ONLY_FIELDS);
}

function withoutEmptyBonuses(item: ItemFields): ItemFields {
  const { bonuses, ...rest } = item;
  if (bonuses === undefined) return item;
  const contributing = Object.entries(bonuses).filter(([, value]) => value !== 0);
  return contributing.length === 0 ? rest : { ...rest, bonuses: Object.fromEntries(contributing) };
}

/** Цена без единой ненулевой монеты — не цена в ноль, а неназванная цена: её при вещи не хранят. */
function withoutEmptyPrice(item: ItemFields): ItemFields {
  const { price, ...rest } = item;
  return price === undefined || CURRENCIES.some((currency) => price[currency] > 0) ? item : rest;
}

function withOrderedKinds(item: ItemFields): ItemFields {
  return { ...item, kinds: ITEM_KINDS.filter((kind) => item.kinds.includes(kind)) };
}

function isWearable(item: { readonly kinds: readonly string[] }): boolean {
  return item.kinds.includes(GEAR);
}

function isTrinket(item: { readonly kinds: readonly string[] }): boolean {
  return item.kinds.includes(TRINKET);
}

function hasBonuses(item: ItemDraft): boolean {
  return Object.values(item.bonuses ?? {}).some((value) => value !== 0);
}

/** Надеть вещь без экипировки нельзя, и прибавкам такой вещи остаётся действовать только при себе. */
function bonusesNeedTrinket(item: ItemDraft): boolean {
  return !isWearable(item) && hasBonuses(item);
}

const itemDefinitionSchema = itemDefinitionFields
  .transform(withOrderedKinds)
  .transform(withoutEmptyBonuses)
  .transform(withoutEmptyPrice)
  .superRefine((item, context) => {
    if (!isWearable(item)) {
      for (const field of filledWearableOnlyFields(item)) {
        context.addIssue({ code: "custom", path: [field], message: wearableOnlyRefusal(item.nameRu) });
      }
      if (item.bonuses !== undefined && !isTrinket(item)) {
        context.addIssue({
          code: "custom",
          path: ["kinds"],
          message: idleBonusRefusal(item.nameRu),
        });
      }
    }
  });

/** Вещь с алхимической записью: у вида она есть всегда, потому что записью вид и начинается. */
export type Alchemical = ItemDefinition & { readonly alchemy: NonNullable<ItemDefinition["alchemy"]> };

export type ItemNote = DeepReadonly<z.infer<typeof noteFields>>;
export type ItemDefinition = DeepReadonly<z.infer<typeof itemDefinitionSchema>>;

/** Черновик вещи — то, что приносит правка: заметок он не называет, их ведут свои операции. */
export type ItemDraft = Omit<ItemDefinition, "notes"> & { readonly notes?: readonly ItemNote[] };
export type ItemKind = (typeof ITEM_KINDS)[number];

export function itemDefinitionOf(value: unknown): ItemDefinition {
  return parsedOrRefused(itemDefinitionSchema, value, "вещь");
}

/** Черновик правки ещё не приведён к своим признакам: приводит и судит его агрегат вещей. */
export function itemDraftOf(value: unknown): ItemDraft {
  return parsedOrRefused(itemDefinitionFields, value, "вещь");
}

export function itemPriceOf(value: unknown): ItemDefinition["price"] {
  return parsedOrRefused(coinsSchema, value, "цена");
}

export function wearable(item: ItemDefinition): boolean {
  return isWearable(item);
}

export function countedCarried(item: ItemDefinition): boolean {
  return isTrinket(item);
}

/** Снятая безделушка, чьим прибавкам без неё негде действовать, — отказ, а не молча вернувшийся признак. */
export function droppedNeededTrinket(before: ItemDefinition, after: ItemDraft): boolean {
  return isTrinket(before) && !isTrinket(after) && bonusesNeedTrinket(after);
}

/**
 * Вид алхимии — вещь, о которой ремеслу есть что сказать: у неё есть алхимическая запись, хотя бы
 * пустая. Запись заводят и убирают в книге алхимика; правка вещи её не касается.
 */
export function ingredient(item: ItemDefinition): item is Alchemical {
  return item.alchemy !== undefined;
}

export function alignedItemDefinition(item: ItemDraft): ItemDefinition {
  const unworn = isWearable(item) ? item : withoutWearableOnlyFields(item);
  const carried =
    bonusesNeedTrinket(item) && !isTrinket(item)
      ? { ...unworn, kinds: [...item.kinds, TRINKET] }
      : unworn;
  return parsedOrRefused(itemDefinitionSchema, carried, "вещь");
}

export const ITEMS_FIELDS = {
  itemDefinitions: z.array(itemDefinitionSchema).default([]),
};
