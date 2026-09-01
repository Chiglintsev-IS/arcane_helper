import { describe, expect, it } from "vitest";

import { namedRarityOf, rarityAmong, withRarityNamed } from "./rarities";

const HEALING = "Лечение здоровья";

describe("названная редкость", () => {
  it("свойство называется словом перечня, и выдуманное отвергается с причиной", () => {
    expect(() => namedRarityOf({ nameRu: "лечит", rarity: "common" })).toThrow(/лечит/);
  });

  it("редкость называется словом словаря", () => {
    expect(() => namedRarityOf({ nameRu: HEALING, rarity: "какая-то" })).toThrow();
  });

  it("названного свойства нет — редкости у него тоже нет", () => {
    expect(rarityAmong([], HEALING)).toBeUndefined();
    expect(rarityAmong(withRarityNamed([], HEALING, "rare"), HEALING)).toBe("rare");
  });
});
