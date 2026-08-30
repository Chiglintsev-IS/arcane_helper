import type { SpellRowView } from "@/contract/views";

import { matchesQuery } from "@/ui/shared/lib/searchable";
import { traitsOf, type ActionTraits } from "@/ui/shared/model/actionTraits";

export type SpellFilters = {
  castingTimes: string[];
  prices: number[];
  roles: string[];
  concentration: boolean;
  ritual: boolean;
  prepared: boolean;
  availableNow: boolean;
  query: string;
};

export const NO_FILTERS: SpellFilters = {
  castingTimes: [],
  prices: [],
  roles: [],
  concentration: false,
  ritual: false,
  prepared: false,
  availableNow: false,
  query: "",
};

export type DividingCategories = {
  castingTimes: ReadonlySet<string>;
  prices: number[];
  roles: ReadonlySet<string>;
  concentration: boolean;
  ritual: boolean;
};

export function matchesTraits(traits: ActionTraits, filters: SpellFilters): boolean {
  if (!matchesQuery(traits.nameRu, filters.query)) return false;
  if (filters.castingTimes.length > 0 && !filters.castingTimes.some((v) => v === traits.castingTime)) {
    return false;
  }
  if (filters.roles.length > 0 && !filters.roles.includes(traits.role)) return false;
  if (filters.concentration && !traits.concentration) return false;
  if (filters.prices.length > 0 && !filters.prices.includes(traits.level)) return false;
  return true;
}

export function matchesActionRow(traits: ActionTraits, filters: SpellFilters): boolean {
  if (!matchesTraits(traits, filters)) return false;
  if (filters.ritual) return false;
  return true;
}

export function dividingCategories(spells: readonly SpellRowView[]): DividingCategories {
  const divides = (count: number): boolean => count > 0 && count < spells.length;
  const countOf = (predicate: (spell: SpellRowView) => boolean): number =>
    spells.filter(predicate).length;
  const valuesDividing = <T>(pick: (spell: SpellRowView) => T): Set<T> =>
    new Set(
      [...new Set(spells.map(pick))].filter((value) => divides(countOf((s) => pick(s) === value))),
    );

  return {
    castingTimes: valuesDividing((spell) => spell.castingTime.type),
    prices: [...valuesDividing((spell) => spell.slotPrice)].sort((a, b) => a - b),
    roles: valuesDividing((spell) => spell.role),
    concentration: divides(countOf((spell) => spell.concentration)),
    ritual: divides(countOf((spell) => spell.ritualAvailable)),
  };
}

function matches(spell: SpellRowView, filters: SpellFilters): boolean {
  if (!matchesTraits(traitsOf(spell), filters)) return false;
  if (filters.ritual && !spell.ritualAvailable) return false;
  if (filters.prepared && !spell.prepared) return false;
  if (filters.availableNow && spell.unavailable) return false;
  return true;
}

export function filterSpells(
  spells: readonly SpellRowView[],
  filters: SpellFilters,
): SpellRowView[] {
  return spells.filter((spell) => matches(spell, filters));
}

export function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}
