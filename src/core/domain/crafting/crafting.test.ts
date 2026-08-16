import { describe, expect, it } from "vitest";

import { Crafting } from "./crafting";

const EMPTY = { ingredientKnowledge: [] };

function withMoonHerb(): Crafting {
  return Crafting.of(EMPTY).noteIngredient("Лунная трава");
}

describe("ремесло", () => {
  it("вид записывается один раз", () => {
    const twice = withMoonHerb().noteIngredient("Лунная трава");

    expect(twice.all).toHaveLength(1);
    expect(twice.find("Лунная трава")?.nameRu).toBe("Лунная трава");
  });

  it("незаписанного вида среди записанных нет", () => {
    expect(Crafting.of(EMPTY).find("Лунная трава")).toBeUndefined();
  });

  it("свойство раскрывается только у записанного вида", () => {
    expect(() =>
      Crafting.of(EMPTY).revealProperty("Лунная трава", {
        number: 1,
        nameRu: "Лечение здоровья",
        rarity: "common",
      }),
    ).toThrow(/Лунная трава/);
  });

  it("раскрытое свойство встаёт под своим номером", () => {
    const known = withMoonHerb()
      .revealProperty("Лунная трава", { number: 1, nameRu: "Лечение здоровья", rarity: "common" })
      .find("Лунная трава");

    expect(known?.properties).toEqual([
      { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
    ]);
  });

  it("раскрытое у одного вида не трогает соседний", () => {
    const both = withMoonHerb().noteIngredient("Багровый корень");
    const revealed = both.revealProperty("Лунная трава", {
      number: 1,
      nameRu: "Лечение здоровья",
      rarity: "common",
    });

    expect(revealed.find("Багровый корень")?.properties).toEqual([]);
    expect(revealed.all.map((ingredient) => ingredient.nameRu)).toEqual([
      "Лунная трава",
      "Багровый корень",
    ]);
  });

  it("номер раскрывается через нераскрытый предыдущий", () => {
    const known = withMoonHerb()
      .revealProperty("Лунная трава", { number: 3, nameRu: "Взрыв", rarity: "rare" })
      .find("Лунная трава");

    expect(known?.properties.map((property) => property.number)).toEqual([3]);
  });

  it("занятый номер второй раз не раскрывается", () => {
    const once = withMoonHerb().revealProperty("Лунная трава", {
      number: 1,
      nameRu: "Лечение здоровья",
      rarity: "common",
    });

    expect(() =>
      once.revealProperty("Лунная трава", { number: 1, nameRu: "Взрыв", rarity: "rare" }),
    ).toThrow(/номером 1/);
  });

  it("раскрытое у вида называет свои направления по одному разу", () => {
    const known = withMoonHerb()
      .revealProperty("Лунная трава", { number: 1, nameRu: "Лечение здоровья", rarity: "common" })
      .revealProperty("Лунная трава", { number: 2, nameRu: "Пробуждение", rarity: "common" })
      .revealProperty("Лунная трава", { number: 3, nameRu: "Взрыв", rarity: "rare" });

    expect(known.directionsOf("Лунная трава")).toEqual(["potions", "transmutation"]);
  });

  it("направления незаписанного вида не называются", () => {
    expect(() => Crafting.of(EMPTY).directionsOf("Лунная трава")).toThrow(/Лунная трава/);
  });

  it("записанное по ошибке забывается", () => {
    expect(withMoonHerb().forgetIngredient("Лунная трава").all).toEqual([]);
    expect(() => Crafting.of(EMPTY).forgetIngredient("Лунная трава")).toThrow(/Лунная трава/);
  });

  it("ремесло владеет только своим полем состояния", () => {
    expect(Crafting.of(EMPTY).toState()).toEqual({ ingredientKnowledge: [] });
  });
});
