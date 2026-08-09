/**
 * Проекция действующего: что висит на персонаже прямо сейчас.
 *
 * Вкладов числами наружу не уходит: их складывает лист, и второй экземпляр того же числа разошёлся
 * бы с ним молча. Уходит признак — двигает ли эффект защиту: приложение не хранит цель эффекта, и
 * «Доспехи мага», наложенные на союзника, обязаны быть видны игроку как строка, поднявшая его же КД.
 */

import type { ActiveEffectView } from "@/contract/views";

import type { CharacterState } from "@/core/domain/assembly/state";

export function toEffectViews(character: CharacterState): ActiveEffectView[] {
  return character.activeEffects.map((effect) => ({
    id: effect.id,
    nameRu: effect.nameRu,
    endConditionRu: effect.endConditionRu,
    isConcentration: effect.isConcentration,
    changesArmorClass: effect.contributions.length > 0,
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
