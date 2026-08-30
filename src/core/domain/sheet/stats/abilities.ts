import { MAXIMUM_ABILITY_SCORE, MINIMUM_ABILITY_SCORE } from "@/core/domain/character/abilities";
import { recordOf } from "@/core/domain/shared/records";
import { ABILITIES, abilityStatId, type Ability } from "@/core/domain/shared/stats";

import { defineStat, ownCandidate, type Stat } from "../resolve";

export function abilityStats(
  scores: Readonly<Record<Ability, number>>,
): Readonly<Record<Ability, Stat>> {
  return recordOf(ABILITIES, (ability) =>
    defineStat({
      id: abilityStatId(ability),
      range: { minimum: MINIMUM_ABILITY_SCORE, maximum: MAXIMUM_ABILITY_SCORE },
      methods: () => [ownCandidate(scores[ability])],
    }),
  );
}
