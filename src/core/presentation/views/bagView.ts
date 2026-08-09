/**
 * Проекция сумки: деньги, вещи с запасами и защита.
 *
 * Вещь и её запас соединяются здесь: «что это такое» знают вещи, «сколько этого у меня» —
 * снаряжение, и друг о друге они не знают намеренно. Соединение — дело показывающего, а не их.
 *
 * Прибавки едут все, что у вещи записаны: чьей категории они не положены, у того их и нет —
 * владелец вещи снимает их при записи, и повторять его отбор здесь значило бы завести вторую
 * проверку того же правила.
 */

import type { BagView, ItemView } from "@/contract/views";

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { Equipment } from "@/core/domain/equipment/equipment";
import { Items } from "@/core/domain/items/items";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { CURRENCIES } from "@/core/domain/shared/schema";
import { STAT_IDS } from "@/core/domain/shared/stats";

function itemView(item: ItemDefinition, equipment: Equipment): ItemView {
  return {
    id: item.id,
    nameRu: item.nameRu,
    kind: item.kind,
    bagCount: equipment.bagCount(item.id),
    wornCount: equipment.wornCount(item.id),
    ...(item.price === undefined ? {} : { price: item.price }),
    bonuses: STAT_IDS.flatMap((stat) => {
      const value = item.bonuses?.[stat];
      return value === undefined ? [] : [{ stat, value }];
    }),
    ...(item.armor === undefined
      ? {}
      : {
          armor: {
            base: item.armor.base,
            ...(item.armor.category === undefined ? {} : { category: item.armor.category }),
          },
        }),
    ...(item.note === undefined ? {} : { note: item.note }),
  };
}

export function toBagView(character: CharacterState): BagView {
  const { money } = character.equipment;
  const equipment = Equipment.of(character);
  const armorClass = Character.of(character).sheet.breakdown("armorClass");

  // Доспех, по которому считается защита, называет сама свёртка: второго счёта здесь нет.
  const wornArmor = armorClass.parts.find(
    (part) => part.applied && part.contribution.kind === "method",
  );

  return {
    money: CURRENCIES.map((currency) => ({ currency, amount: money[currency] })),
    items: Items.of(character).all.map((item) => itemView(item, equipment)),
    armorClass: {
      value: armorClass.value,
      ...(wornArmor === undefined ? {} : { wornArmorNameRu: wornArmor.source.nameRu }),
    },
  };
}
