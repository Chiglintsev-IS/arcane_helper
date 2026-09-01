import type { BagView, ItemView } from "@/contract/views";

import { materialNeeds, type MaterialNeed } from "@/core/application/casting/material";
import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { AlchemicalPropertyName, AlchemicalRarity } from "@/core/domain/catalog/alchemy";
import type { Spell } from "@/core/domain/catalog/spell";
import { Equipment } from "@/core/domain/equipment/equipment";
import { Items } from "@/core/domain/items/items";
import { countedCarried, type ItemDefinition } from "@/core/domain/items/schema";
import { bonusFactsOf } from "@/core/domain/sheet/families";
import { CURRENCIES } from "@/core/domain/shared/schema";
import { STAT_IDS } from "@/core/domain/shared/stats";

function itemView(
  item: ItemDefinition,
  equipment: Equipment,
  rarityOf: (nameRu: AlchemicalPropertyName) => AlchemicalRarity | undefined,
  need: MaterialNeed | undefined,
): ItemView {
  const bonuses = STAT_IDS.flatMap((stat) => {
    const value = item.bonuses?.[stat];
    return value === undefined ? [] : [{ stat, value }];
  });

  return {
    id: item.id,
    nameRu: item.nameRu,
    kinds: [...item.kinds],
    bagCount: equipment.bagCount(item.id),
    wornCount: equipment.wornCount(item.id),
    wanted: equipment.wants(item.id),
    worksCarried: countedCarried(item),
    ...(item.price === undefined ? {} : { price: item.price }),
    bonuses,
    bonusFacts: bonusFactsOf(bonuses).map((fact) => ({
      value: fact.value,
      targets: fact.targets.map((target) => ({ kind: target.kind, id: target.id })),
    })),
    spellcastingFocus: item.spellcastingFocus === true,
    ...(item.note === undefined ? {} : { note: item.note }),
    alchemicalProperties: (item.alchemy?.properties ?? []).map((property) => {
      const rarity = rarityOf(property.nameRu);
      return {
        number: property.number,
        nameRu: property.nameRu,
        ...(rarity === undefined ? {} : { rarity }),
      };
    }),
    neededForRu: need?.spellNamesRu ?? [],
  };
}

export function toBagView(character: CharacterState, spells: readonly Spell[]): BagView {
  const { money } = character.equipment;
  const equipment = Equipment.of(character);
  const items = Items.of(character);
  const root = Character.of(character);
  const armorClass = root.sheet.breakdown("armorClass");
  const needs = new Map(
    materialNeeds(spells, character).map((need) => [need.material.id, need] as const),
  );

  const namedBase = armorClass.parts.find(
    (part) => part.applied && part.contribution.kind === "method",
  );

  return {
    money: CURRENCIES.map((currency) => ({ currency, amount: money[currency] })),
    items: items.all.map((item) =>
      itemView(item, equipment, (nameRu) => root.crafting.rarityOf(nameRu), needs.get(item.id)),
    ),
    armorClass: {
      value: armorClass.value,
      ...(namedBase === undefined ? {} : { baseNameRu: namedBase.source.nameRu }),
    },
  };
}
