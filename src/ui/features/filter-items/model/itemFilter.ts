import type { ItemView } from "@/contract/views";
import { itemTraitsOf, type ItemTrait } from "@/ui/entities/character/lib/itemTraits";
import { matchesQuery } from "@/ui/shared/lib/searchable";

/**
 * Чип сита трёхпозиционный: «только это», «кроме этого» и снят. Так «всё, кроме ингредиентов»
 * набирается одним нажатием, а не выбором четырёх оставшихся признаков.
 */
export type TraitStance = "only" | "not";

export type TraitSift = readonly { readonly trait: ItemTrait; readonly stance: TraitStance }[];

export const NO_SIFT: TraitSift = [];

export function stanceOf(sift: TraitSift, trait: ItemTrait): TraitStance | undefined {
  return sift.find((one) => one.trait === trait)?.stance;
}

export function cycled(sift: TraitSift, trait: ItemTrait): TraitSift {
  const stance = stanceOf(sift, trait);
  const without = sift.filter((one) => one.trait !== trait);
  if (stance === undefined) return [...without, { trait, stance: "only" }];
  if (stance === "only") return [...without, { trait, stance: "not" }];
  return without;
}

/** Вещь проходит, когда при ней каждый затребованный признак и ни одного отвергнутого. */
export function sifts(item: ItemView, sift: TraitSift, query: string): boolean {
  const traits = itemTraitsOf(item);
  const suits = sift.every((one) =>
    one.stance === "only" ? traits.includes(one.trait) : !traits.includes(one.trait),
  );
  return suits && matchesQuery(item.nameRu, query);
}
