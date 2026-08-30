import { proficiencyBonus } from "@/core/domain/character/abilities";

import { defineStat, ownCandidate, type Stat } from "../resolve";

export function proficiencyStat(level: number): Stat {
  return defineStat({
    id: "proficiencyBonus",
    methods: () => [ownCandidate(proficiencyBonus(level))],
  });
}
