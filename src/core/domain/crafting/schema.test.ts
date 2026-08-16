import { describe, expect, it } from "vitest";

import { ingredientKnowledgeOf } from "./schema";

describe("знание об ингредиенте", () => {
  it("свойство называется словом перечня, и выдуманное отвергается с причиной", () => {
    expect(() =>
      ingredientKnowledgeOf({
        nameRu: "Лунная трава",
        properties: [{ number: 1, nameRu: "лечит", rarity: "common" }],
      }),
    ).toThrow(/лечит/);
  });

  it("свойство встаёт под своим номером и несёт редкость", () => {
    const known = ingredientKnowledgeOf({
      nameRu: "Лунная трава",
      properties: [{ number: 2, nameRu: "Лечение здоровья", rarity: "rare" }],
    });

    expect(known.properties).toEqual([{ number: 2, nameRu: "Лечение здоровья", rarity: "rare" }]);
  });

  it("вид без единого раскрытого свойства остаётся записью", () => {
    expect(ingredientKnowledgeOf({ nameRu: "Лунная трава" }).properties).toEqual([]);
  });

  it("номер свойства не выходит за четвёртый", () => {
    for (const number of [0, 5]) {
      expect(() =>
        ingredientKnowledgeOf({
          nameRu: "Лунная трава",
          properties: [{ number, nameRu: "Лечение здоровья", rarity: "common" }],
        }),
      ).toThrow();
    }
  });

  it("редкость называется словом словаря", () => {
    expect(() =>
      ingredientKnowledgeOf({
        nameRu: "Лунная трава",
        properties: [{ number: 1, nameRu: "Лечение здоровья", rarity: "какая-то" }],
      }),
    ).toThrow();
  });

  it("под одним номером стоит одно свойство", () => {
    expect(() =>
      ingredientKnowledgeOf({
        nameRu: "Лунная трава",
        properties: [
          { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
          { number: 1, nameRu: "Ядовитый урон", rarity: "rare" },
        ],
      }),
    ).toThrow(/номером 1/);
  });

  it("одно свойство раскрывается у вида один раз", () => {
    expect(() =>
      ingredientKnowledgeOf({
        nameRu: "Лунная трава",
        properties: [
          { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
          { number: 2, nameRu: "Лечение здоровья", rarity: "common" },
        ],
      }),
    ).toThrow(/уже раскрыто/);
  });

  it("свойства хранятся по возрастанию номера", () => {
    const known = ingredientKnowledgeOf({
      nameRu: "Лунная трава",
      properties: [
        { number: 4, nameRu: "Взрыв", rarity: "legendary" },
        { number: 2, nameRu: "Лечение здоровья", rarity: "common" },
      ],
    });

    expect(known.properties.map((property) => property.number)).toEqual([2, 4]);
  });

  it("название вида не бывает пустым", () => {
    expect(() => ingredientKnowledgeOf({ nameRu: "  " })).toThrow();
  });
});
