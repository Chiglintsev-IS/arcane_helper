import { abilityModifier } from "@/core/domain/character/abilities";

import { defineStat, ownCandidate, type Stat } from "../resolve";

export const UNARMORED_ARMOR_CLASS_BASE = 10;

export function armorClassStat(dexterity: Stat): Stat {
  return defineStat({
    id: "armorClass",
    from: [dexterity],
    methods: (read, brought) => {
      const dexterityModifier = abilityModifier(read(dexterity));

      return [
        ownCandidate(UNARMORED_ARMOR_CLASS_BASE + dexterityModifier),
        ...brought.map((method) => ({ value: method.base + dexterityModifier, grownFrom: method })),
      ];
    },
  });
}
