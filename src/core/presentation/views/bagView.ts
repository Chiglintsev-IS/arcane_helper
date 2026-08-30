import type { BagView, ItemView, MissingMaterialView } from "@/contract/views";

import { materialNeeds, type MaterialNeed } from "@/core/application/casting/material";
import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { Equipment } from "@/core/domain/equipment/equipment";
import { Items } from "@/core/domain/items/items";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { bonusFactsOf } from "@/core/domain/sheet/families";
import { CURRENCIES } from "@/core/domain/shared/schema";
import { STAT_IDS } from "@/core/domain/shared/stats";

function itemView(
  item: ItemDefinition,
  equipment: Equipment,
  need: MaterialNeed | undefined,
): ItemView {
  const bonuses = STAT_IDS.flatMap((stat) => {
    const value = item.bonuses?.[stat];
    return value === undefined ? [] : [{ stat, value }];
  });

  return {
    id: item.id,
    nameRu: item.nameRu,
    kind: item.kind,
    bagCount: equipment.bagCount(item.id),
    wornCount: equipment.wornCount(item.id),
    ...(item.price === undefined ? {} : { price: item.price }),
    bonuses,
    bonusFacts: bonusFactsOf(bonuses).map((fact) => ({
      value: fact.value,
      targets: fact.targets.map((target) => ({ kind: target.kind, id: target.id })),
    })),
    ...(item.armor === undefined
      ? {}
      : {
          armor: {
            base: item.armor.base,
            ...(item.armor.category === undefined ? {} : { category: item.armor.category }),
          },
        }),
    spellcastingFocus: item.spellcastingFocus === true,
    ...(item.note === undefined ? {} : { note: item.note }),
    neededForRu: need?.spellNamesRu ?? [],
  };
}

function missingView(need: MaterialNeed, item: ItemDefinition | undefined): MissingMaterialView {
  const { material } = need;
  const price = item === undefined ? material.price : item.price;
  return {
    spellId: need.spellId,
    nameRu: material.nameRu,
    ...(price === undefined ? {} : { price }),
    consumed: material.consumed,
    neededForRu: need.spellNamesRu,
    coveredByFocus: need.coveredByFocus,
    ...(item === undefined ? {} : { itemId: item.id }),
    ...(item?.note === undefined ? {} : { note: item.note }),
  };
}

export function toBagView(character: CharacterState, spells: readonly Spell[]): BagView {
  const { money } = character.equipment;
  const equipment = Equipment.of(character);
  const items = Items.of(character);
  const armorClass = Character.of(character).sheet.breakdown("armorClass");
  const allNeeds = materialNeeds(spells, character);
  const needs = new Map(allNeeds.map((need) => [need.material.id, need] as const));

  const urgent = allNeeds.filter(
    (need) => !need.coveredByFocus && equipment.bagCount(need.material.id) === 0,
  );
  const covered = allNeeds.filter(
    (need) => need.coveredByFocus && items.find(need.material.id) === undefined,
  );

  const wornArmor = armorClass.parts.find(
    (part) => part.applied && part.contribution.kind === "method",
  );

  return {
    money: CURRENCIES.map((currency) => ({ currency, amount: money[currency] })),
    items: items.all.map((item) => itemView(item, equipment, needs.get(item.id))),
    missingMaterials: [...urgent, ...covered].map((need) =>
      missingView(need, items.find(need.material.id)),
    ),
    armorClass: {
      value: armorClass.value,
      ...(wornArmor === undefined ? {} : { wornArmorNameRu: wornArmor.source.nameRu }),
    },
  };
}
