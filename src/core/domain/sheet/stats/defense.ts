import { abilityModifier } from "@/core/domain/character/abilities";
import type { ArmorCategory, StatMethod } from "@/core/domain/shared/stats";

import { defineStat, ownCandidate, type Stat } from "../resolve";

export const UNARMORED_ARMOR_CLASS_BASE = 10;

const DEXTERITY_LIMIT: Readonly<Record<ArmorCategory, number>> = {
  light: Number.POSITIVE_INFINITY,
  medium: 2,
  heavy: 0,
};

type ArmorMethod = Extract<StatMethod, { family: "armor" }>;
type SpellMethod = Extract<StatMethod, { family: "spell" }>;

function isArmor(method: StatMethod): method is ArmorMethod {
  return method.family === "armor";
}

function dexterityLimit(category: ArmorCategory | undefined): number {
  return category === undefined ? Number.POSITIVE_INFINITY : DEXTERITY_LIMIT[category];
}

function isSpell(method: StatMethod): method is SpellMethod {
  return method.family === "spell";
}

export function armorClassStat(dexterity: Stat): Stat {
  return defineStat({
    id: "armorClass",
    from: [dexterity],
    methods: (read, brought) => {
      const dexterityModifier = abilityModifier(read(dexterity));
      const armor = brought.filter(isArmor);
      const fromArmor = armor.map((method) => ({
        value: method.base + Math.min(dexterityModifier, dexterityLimit(method.category)),
        grownFrom: method,
      }));
      const fromSpells =
        armor.length > 0
          ? []
          : brought.filter(isSpell).map((method) => ({
              value: method.base + dexterityModifier,
              grownFrom: method,
            }));

      return [
        ownCandidate(UNARMORED_ARMOR_CLASS_BASE + dexterityModifier),
        ...fromArmor,
        ...fromSpells,
      ];
    },
  });
}
