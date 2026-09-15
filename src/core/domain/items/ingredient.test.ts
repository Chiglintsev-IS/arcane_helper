import { describe, expect, it } from "vitest";

import { NO_ALCHEMY, revealedPropertyOf, unrevealedNumbers } from "./ingredient";
import { itemDefinitionOf } from "./schema";

function ingredientWith(properties: readonly unknown[]): unknown {
  return itemDefinitionOf({
    id: "лунная-трава",
    nameRu: "Лунная трава",
    kinds: [],
    alchemy: { properties },
  });
}

describe("алхимия ингредиента", () => {
  it("свойство называется словами стола, а пустое имя отвергается", () => {
    expect(revealedPropertyOf({ number: 1, nameRu: "лечит, но тошнит" })).toEqual({
      number: 1,
      nameRu: "лечит, но тошнит",
    });
    expect(() => ingredientWith([{ number: 1, nameRu: "" }])).toThrow();
  });

  it("свойство встаёт под своим номером", () => {
    const item = itemDefinitionOf({
      id: "лунная-трава",
      nameRu: "Лунная трава",
      kinds: [],
      alchemy: { properties: [{ number: 2, nameRu: "Лечение здоровья" }] },
    });

    expect(item.alchemy?.properties).toEqual([{ number: 2, nameRu: "Лечение здоровья" }]);
  });

  it("вещь без алхимической записи видом не считается вовсе", () => {
    const item = itemDefinitionOf({
      id: "лунная-трава",
      nameRu: "Лунная трава",
      kinds: [],
    });

    expect(item.alchemy).toBeUndefined();
  });

  it("вид начинается с пустой записи: раскрывать ещё нечего, а вид уже есть", () => {
    const item = itemDefinitionOf({
      id: "лунная-трава",
      nameRu: "Лунная трава",
      kinds: [],
      alchemy: {},
    });

    expect(item.alchemy?.properties).toEqual([]);
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
      kinds: [],
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
    expect(unrevealedNumbers(NO_ALCHEMY)).toEqual([1, 2, 3, 4]);
  });

  it("раскрытое свойство приходит разобранным, а имя ему даёт стол", () => {
    expect(revealedPropertyOf({ number: 1, nameRu: "Отвращение к пиву" })).toEqual({
      number: 1,
      nameRu: "Отвращение к пиву",
    });
    expect(() => revealedPropertyOf({ number: 1, nameRu: "  " })).toThrow();
  });

  it("алхимия живёт при всякой вещи: мифриловая кольчуга и экипировка, и сырьё состава", () => {
    const mail = itemDefinitionOf({
      id: "кольчуга",
      nameRu: "Мифриловая кольчуга",
      kinds: ["gear"],
      alchemy: { properties: [{ number: 1, nameRu: "Лечение здоровья" }] },
    });

    expect(mail.alchemy?.properties).toHaveLength(1);
  });
});
