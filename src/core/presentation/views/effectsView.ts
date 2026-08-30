import type { ActiveEffectView } from "@/contract/views";

import type { CharacterState } from "@/core/domain/assembly/state";

export function toEffectViews(character: CharacterState): ActiveEffectView[] {
  return character.activeEffects.map((effect) => ({
    id: effect.id,
    nameRu: effect.nameRu,
    endConditionRu: effect.endConditionRu,
    isConcentration: effect.isConcentration,
    changesArmorClass: effect.contributions.some(
      (contribution) => contribution.stat === "armorClass",
    ),
    ...(effect.note === undefined ? {} : { noteRu: effect.note }),
    ...(effect.repeatableAction === undefined
      ? {}
      : {
          repeatableAction: {
            label: effect.repeatableAction.label,
            description: effect.repeatableAction.description,
          },
        }),
  }));
}
