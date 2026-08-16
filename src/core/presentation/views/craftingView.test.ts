import { describe, expect, it } from "vitest";

import { toCraftingView } from "./craftingView";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withIngredientKnowledge } from "@/core/infrastructure/catalog/thorne/fixtures";

describe("проекция знания об ингредиентах", () => {
  it("знание едет проекцией видами и раскрытым у них", () => {
    const known = withIngredientKnowledge(createThorne(), "Лунная трава", [
      { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
      { number: 3, nameRu: "Взрыв", rarity: "rare" },
    ]);

    expect(toCraftingView(known).ingredients).toEqual([
      {
        nameRu: "Лунная трава",
        properties: [
          { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
          { number: 3, nameRu: "Взрыв", rarity: "rare" },
        ],
      },
    ]);
  });

  it("записанный вид без раскрытого едет пустым списком свойств", () => {
    const noted = withIngredientKnowledge(createThorne(), "Багровый корень");

    expect(toCraftingView(noted).ingredients).toEqual([
      { nameRu: "Багровый корень", properties: [] },
    ]);
  });

  it("не записано ничего — не едет ни один вид", () => {
    expect(toCraftingView(createThorne()).ingredients).toEqual([]);
  });
});
