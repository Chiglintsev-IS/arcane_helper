import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { Character } from "./character";

describe("персонаж целиком", () => {
  it("знание переживает исчезновение запаса", () => {
    const stocked = Character.of(createThorne());
    const withHerb = stocked
      .withItems(stocked.items.addDefinition({ nameRu: "Лунная трава", kinds: ["ingredient"] }))
      .withCrafting(stocked.crafting.noteIngredient("Лунная трава"));

    const known = withHerb.withCrafting(
      withHerb.crafting.revealProperty("Лунная трава", {
        number: 1,
        nameRu: "Лечение здоровья",
        rarity: "common",
      }),
    );

    const herbId = known.items.all.find((item) => item.nameRu === "Лунная трава")?.id ?? "";
    const stockedUp = known.withEquipment(known.equipment.adjustBagCount(herbId, 3));
    const spentAndGone = stockedUp
      .withEquipment(stockedUp.equipment.adjustBagCount(herbId, -3))
      .withItems(stockedUp.items.removeDefinition(herbId));

    expect(spentAndGone.equipment.bagCount(herbId)).toBe(0);
    expect(spentAndGone.items.find(herbId)).toBeUndefined();
    expect(spentAndGone.crafting.find("Лунная трава")?.properties).toEqual([
      { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
    ]);
  });
});
