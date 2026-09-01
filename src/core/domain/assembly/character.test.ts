import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { Items } from "@/core/domain/items/items";
import { Character } from "./character";

const MOON_HERB = "Лунная трава";
const HERB_ID = Items.idFromName(MOON_HERB);

describe("персонаж целиком", () => {
  it("знание переживает исчезновение запаса, но уходит вместе с вещью", () => {
    const root = Character.of(createThorne());
    const known = root.withItems(
      root.items
        .addDefinition({ nameRu: MOON_HERB, kinds: ["ingredient"] })
        .revealProperty(HERB_ID, { number: 1, nameRu: "Лечение здоровья" }),
    );

    const stockedUp = known.withEquipment(known.equipment.adjustBagCount(HERB_ID, 3));
    const spent = stockedUp.withEquipment(stockedUp.equipment.adjustBagCount(HERB_ID, -3));

    expect(spent.equipment.bagCount(HERB_ID)).toBe(0);
    expect(spent.items.alchemyOf(HERB_ID).properties).toEqual([
      { number: 1, nameRu: "Лечение здоровья" },
    ]);

    const gone = spent.withItems(spent.items.removeDefinition(HERB_ID));

    expect(gone.items.find(HERB_ID)).toBeUndefined();
    expect(gone.items.ingredients.map((item) => item.id)).not.toContain(HERB_ID);
  });
});
