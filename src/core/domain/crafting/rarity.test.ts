import { describe, expect, it } from "vitest";

import { rarities, rarityRow } from "./rarity";

describe("цена редкости", () => {
  it("перечень называет все слова редкости, какими стол помечает свойство", () => {
    expect(rarities().map((step) => step.nameRu)).toEqual([
      "Обычное",
      "Необычное",
      "Редкое",
      "Очень редкое",
      "Легендарное",
      "Особое",
    ]);
  });

  it("у ступени лестницы каждая цена — число", () => {
    expect(rarities()[2]).toEqual({
      nameRu: "Редкое",
      main: 5,
      additional: 5,
      suppression: 4,
      research: 2,
    });
  });

  it("особая редкость стоит в перечне, а чисел не называет: их называет стол", () => {
    expect(rarities().at(-1)).toEqual({
      nameRu: "Особое",
      main: null,
      additional: null,
      suppression: null,
      research: null,
    });
    expect(rarityRow("Особое")).toBeNull();
  });
});
