import { ABILITIES, saveStatId, type StatId } from "@/core/domain/shared/stats";

type StatFamilyId = "saves";

const STAT_FAMILIES: readonly {
  readonly id: StatFamilyId;
  readonly members: readonly StatId[];
}[] = [{ id: "saves", members: ABILITIES.map(saveStatId) }];

type StatBonus = { readonly stat: StatId; readonly value: number };

type BonusTarget =
  | { readonly kind: "stat"; readonly id: StatId }
  | { readonly kind: "family"; readonly id: StatFamilyId };

type BonusFact = { readonly value: number; readonly targets: readonly BonusTarget[] };

function familyValue(bonuses: readonly StatBonus[], members: readonly StatId[]): number | undefined {
  const values = members.map((stat) => bonuses.find((bonus) => bonus.stat === stat)?.value);
  const [first] = values;
  if (first === undefined) return undefined;
  return values.every((value) => value === first) ? first : undefined;
}

function namedFamilies(bonuses: readonly StatBonus[]) {
  return STAT_FAMILIES.flatMap((family) => {
    const value = familyValue(bonuses, family.members);
    return value === undefined ? [] : [{ ...family, value }];
  });
}

type NamedBonus = { readonly target: BonusTarget; readonly value: number };

function namedBonuses(bonuses: readonly StatBonus[]): readonly NamedBonus[] {
  const families = namedFamilies(bonuses);
  return bonuses.flatMap((bonus, index): NamedBonus[] => {
    const family = families.find((candidate) => candidate.members.includes(bonus.stat));
    if (family === undefined) {
      return [{ target: { kind: "stat", id: bonus.stat }, value: bonus.value }];
    }
    const firstOfFamily = bonuses.findIndex((other) => family.members.includes(other.stat));
    return index === firstOfFamily
      ? [{ target: { kind: "family", id: family.id }, value: family.value }]
      : [];
  });
}

export function bonusFactsOf(bonuses: readonly StatBonus[]): readonly BonusFact[] {
  const named = namedBonuses(bonuses);
  return [...new Set(named.map((bonus) => bonus.value))].map((value) => ({
    value,
    targets: named.filter((bonus) => bonus.value === value).map((bonus) => bonus.target),
  }));
}
