import {
  preparedLimit,
  spellAttackModifier,
  spellSaveDc,
} from "@/core/domain/character/abilities";

import { defineStat, ownCandidate, type Stat } from "../resolve";

const MINIMUM_PREPARED_LIMIT = 1;

export function spellcastingStats(
  spellcastingAbility: Stat,
  proficiency: Stat,
  wizardLevel: number,
): {
  readonly spellSaveDc: Stat;
  readonly spellAttackModifier: Stat;
  readonly preparedLimit: Stat;
} {
  return {
    spellSaveDc: defineStat({
      id: "spellSaveDc",
      from: [spellcastingAbility, proficiency],
      methods: (read) => [
        ownCandidate(
          spellSaveDc({
            score: read(spellcastingAbility),
            proficiencyBonus: read(proficiency),
          }),
        ),
      ],
    }),
    spellAttackModifier: defineStat({
      id: "spellAttackModifier",
      from: [spellcastingAbility, proficiency],
      methods: (read) => [
        ownCandidate(
          spellAttackModifier({
            score: read(spellcastingAbility),
            proficiencyBonus: read(proficiency),
          }),
        ),
      ],
    }),
    preparedLimit: defineStat({
      id: "preparedLimit",
      from: [spellcastingAbility],
      range: { minimum: MINIMUM_PREPARED_LIMIT },
      methods: (read) => [ownCandidate(preparedLimit(read(spellcastingAbility), wizardLevel))],
    }),
  };
}
