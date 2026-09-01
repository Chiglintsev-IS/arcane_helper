import { describe, expect, it } from "vitest";

import { PROPERTY_NUMBERS, revealedPropertyOf } from "./ingredient";
import { itemDefinitionOf } from "./schema";

function ingredientWith(properties: readonly unknown[]): unknown {
  return itemDefinitionOf({
    id: "лунная-трава",
    nameRu: "Лунная трава",
    kinds: ["ingredient"],
    alchemy: { properties },
  });
}

describe("алхимия ингредиента", () => {
  it("свойство называется словом перечня, и выдуманное отвергается с причиной", () => {
    expect(() => ingredientWith([{ number: 1, nameRu: "лечит" }])).toThrow(
      /лечит/,
    );
  });

  it("свойство встаёт под своим номером", () => {
    const item = itemDefinitionOf({
      id: "лунная-трава",
      nameRu: "Лунная трава",
      kinds: ["ingredient"],
      alchemy: { properties: [{ number: 2, nameRu: "Лечение здоровья" }] },
    });

    expect(item.alchemy?.properties).toEqual([{ number: 2, nameRu: "Лечение здоровья" }]);
  });

  it("ингредиент без единого раскрытого свойства остаётся вещью", () => {
    const item = itemDefinitionOf({
      id: "лунная-трава",
      nameRu: "Лунная трава",
      kinds: ["ingredient"],
    });

    expect(item.alchemy).toBeUndefined();
  });

  it("номер свойства не выходит за четвёртый", () => {
    for (const number of [0, 5]) {
      expect(() => ingredientWith([{ number, nameRu: "Лечение здоровья" }])).toThrow();
    }
  });

  it("под одним номером стоит одно свойство", () => {
    expect(() =>
      ingredientWith([
        { number: 1, nameRu: "Лечение здоровья" },
        { number: 1, nameRu: "Ядовитый урон" },
      ]),
    ).toThrow(/номером 1/);
  });

  it("одно свойство раскрывается у вида один раз", () => {
    expect(() =>
      ingredientWith([
        { number: 1, nameRu: "Лечение здоровья" },
        { number: 2, nameRu: "Лечение здоровья" },
      ]),
    ).toThrow(/уже раскрыто/);
  });

  it("свойства хранятся по возрастанию номера", () => {
    const item = itemDefinitionOf({
      id: "лунная-трава",
      nameRu: "Лунная трава",
      kinds: ["ingredient"],
      alchemy: {
        properties: [
          { number: 4, nameRu: "Взрыв" },
          { number: 2, nameRu: "Лечение здоровья" },
        ],
      },
    });

    expect(item.alchemy?.properties.map((property) => property.number)).toEqual([2, 4]);
  });

  it("глубина спрятанного считается от первого до четвёртого номера", () => {
    expect(PROPERTY_NUMBERS).toEqual([1, 2, 3, 4]);
  });

  it("раскрытое свойство приходит разобранным и отвергает выдуманное имя", () => {
    expect(revealedPropertyOf({ number: 1, nameRu: "Лечение здоровья" })).toEqual({
      number: 1,
      nameRu: "Лечение здоровья",
    });
    expect(() => revealedPropertyOf({ number: 1, nameRu: "лечит" })).toThrow(/лечит/);
  });

  it("вещь, которая не ингредиент, алхимии не несёт: отказ называет вещь", () => {
    expect(() =>
      itemDefinitionOf({
        id: "мантия",
        nameRu: "Мантия",
        kinds: ["gear"],
        alchemy: { properties: [{ number: 1, nameRu: "Лечение здоровья" }] },
      }),
    ).toThrow(/не ингредиент/);
  });
});
