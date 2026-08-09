/**
 * Проекция действующих ресурсов: ячейки, руны, очки и числа, которыми открывают ход.
 *
 * Порядок ячеек приходит отсюда посчитанным. Пока шапка сортировала их сама, «по возрастанию
 * уровня» было правилом в двух местах: у владельца ячеек и у того, кто их рисует, — и разъехаться
 * им мешала только привычка.
 *
 * Хитов и Класса Доспеха здесь нет: их считает лист, и повторить их значило бы завести второе
 * число о том же.
 *
 * Запас без журнала не читается: доступность руны — это ещё и непотраченная реакция, а она видна
 * только по ходу боя.
 */

import type { ResourcesView } from "@/contract/views";

import { slotsInOrder } from "@/core/domain/arcana/slots";
import { Character } from "@/core/domain/assembly/character";
import type { Session } from "@/core/application/session";
import { wardingSigilAvailable } from "@/core/application/useCases/effects";

export function toResourcesView(session: Session): ResourcesView {
  const { character } = session;
  const root = Character.of(character);
  const { runes } = root.arcana;

  return {
    slots: slotsInOrder(character.spellSlots).map(({ level, remaining, maximum }) => ({
      level,
      remaining,
      maximum,
    })),
    runes: { remaining: runes.remaining, maximum: runes.maximum },
    spellPoints: root.arcana.spellPoints,
    armorClassAdjustment: root.effects.manualAdjustment("armorAdjustment"),
    passivePerception: root.sheet.value("passivePerception"),
    initiative: root.sheet.value("initiative"),
    wardingSigilAvailable: wardingSigilAvailable(session),
    suppression: {
      firedUpon: character.suppression.firedUpon,
      underDirectSunlight: character.suppression.underDirectSunlight,
    },
  };
}
