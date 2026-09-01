import type { FamiliarView } from "@/contract/views";

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { Familiar } from "@/core/domain/familiar/familiar";
import { FRUBIT } from "@/core/domain/familiar/frubit";

export function toFamiliarView(character: CharacterState): FamiliarView {
  const bonded = Familiar.bondedTo(FRUBIT, Character.of(character).sheet.value("proficiencyBonus"));

  return {
    nameRu: FRUBIT.nameRu,
    kindRu: FRUBIT.kindRu,
    armorClass: FRUBIT.armorClass,
    hitPointsRu: FRUBIT.hitPointsRu,
    speedsRu: [...FRUBIT.speedsRu],
    sensesRu: [...FRUBIT.sensesRu],
    languagesRu: FRUBIT.languagesRu,
    dangerRu: FRUBIT.dangerRu,
    proficiencyRu: FRUBIT.proficiencyRu,
    passivePerception: bonded.passivePerception,
    checks: bonded.checks.map((check) => ({ ...check })),
    scores: bonded.scores.map((score) => ({ ...score })),
    traits: FRUBIT.traits.map((trait) => ({ ...trait })),
    obligationsRu: [...FRUBIT.obligationsRu],
  };
}
