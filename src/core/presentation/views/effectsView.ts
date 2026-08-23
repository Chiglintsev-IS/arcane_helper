/**
 * Проекция действующего: что висит на персонаже прямо сейчас.
 *
 * Вкладов числами наружу не уходит: их складывает лист, и второй экземпляр того же числа разошёлся
 * бы с ним молча. Уходит признак — двигает ли эффект защиту: приложение не хранит цель эффекта, и
 * «Доспехи мага», наложенные на союзника, обязаны быть видны игроку как строка, поднявшая его же КД.
 * Признак спрашивает у вклада, какой он величины: вклад в скорость поправкой к защите не является.
 */

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
