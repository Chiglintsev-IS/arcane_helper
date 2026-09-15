import type { ItemView } from "@/contract/views";
import { RULE_ACTIVE, RULE_MARK } from "@/ui/shared/ui/rule";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

import { itemKindLabel, WANTED_LABEL } from "./labels";

/**
 * Признак вещи — то, что о ней говорят одним словом: чем её считают, что с ней делают и хотят ли её
 * купить. Признаки набираются вместе, потому одна вещь бывает и экипировкой, и ингредиентом.
 * Фокусировка признаком не бывает: ею проводят магию, а носят её как всякую экипировку.
 */
export const ITEM_TRAITS = ["gear", "ingredient", "wanted"] as const;

/**
 * Признаки, которые ставят рукой. Ингредиента среди них нет: вещь становится видом алхимии от
 * записи в книге алхимика, а не от пометки в карточке, и снятой пометкой знание не отменяют.
 */
export const EDITABLE_ITEM_TRAITS = ["gear", "wanted"] as const;

export type ItemTrait = (typeof ITEM_TRAITS)[number];

export const PLAIN_ITEM = "просто вещь";

export function itemTraitLabel(trait: ItemTrait): string {
  return trait === "wanted" ? WANTED_LABEL : itemKindLabel(trait);
}

export function itemTraitsOf(item: ItemView): readonly ItemTrait[] {
  return ITEM_TRAITS.filter((trait) => {
    if (trait === "wanted") return item.wanted;
    if (trait === "ingredient") return item.alchemical;
    return item.kinds.includes(trait);
  });
}

/** Тон признака один и тот же на чипе, в строке и в карточке: признак узнают раньше, чем читают. */
export const ITEM_TRAIT_TEXT: Record<ItemTrait, string> = {
  gear: "text-accent",
  ingredient: TONE_TEXT.ritual,
  wanted: "text-accent",
};

export const ITEM_TRAIT_MARK: Record<ItemTrait, string> = {
  gear: RULE_ACTIVE,
  ingredient: RULE_MARK.ritual,
  wanted: RULE_ACTIVE,
};
