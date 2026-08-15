import { describe, expect, it } from "vitest";

import { bonusFactsOf } from "./families";

/** Шесть спасбросков плаща защиты: то самое семейство, названное целиком. */
const ALL_SAVES = [
  { stat: "save:strength", value: 1 },
  { stat: "save:dexterity", value: 1 },
  { stat: "save:constitution", value: 1 },
  { stat: "save:intelligence", value: 1 },
  { stat: "save:wisdom", value: 1 },
  { stat: "save:charisma", value: 1 },
] as const;

describe("семейства величин", () => {
  it("равная прибавка всем спасброскам — одно имя, неполная и неравная — перечень", () => {
    // Плащ защиты: шесть спасбросков зовутся одним именем и стоят на месте первого из них — порядок
    // величин свёртка не переставляет.
    expect(bonusFactsOf([{ stat: "armorClass", value: 1 }, ...ALL_SAVES])).toEqual([
      {
        value: 1,
        targets: [
          { kind: "stat", id: "armorClass" },
          { kind: "family", id: "saves" },
        ],
      },
    ]);

    // Названы не все шесть — имени у целого нет, и каждая величина зовётся своим именем.
    expect(bonusFactsOf(ALL_SAVES.slice(0, 3))).toEqual([
      {
        value: 1,
        targets: [
          { kind: "stat", id: "save:strength" },
          { kind: "stat", id: "save:dexterity" },
          { kind: "stat", id: "save:constitution" },
        ],
      },
    ]);

    // Недостача первой величины семейства значит ровно то же, что недостача любой другой.
    expect(bonusFactsOf(ALL_SAVES.slice(1)).flatMap((fact) => fact.targets)).toHaveLength(5);

    // Числа разные — имени у целого нет, и о каждой величине говорят отдельно.
    expect(
      bonusFactsOf([...ALL_SAVES.slice(0, 5), { stat: "save:charisma", value: 2 }]).flatMap(
        (fact) => fact.targets,
      ),
    ).toHaveLength(6);
  });
});

describe("прибавки вещи по числам", () => {
  it("равные числа — одна прибавка при всех своих величинах", () => {
    // Венец, двигающий пять величин на одно и то же: число сказано один раз, перечень идёт после.
    expect(
      bonusFactsOf([
        { stat: "armorClass", value: 1 },
        { stat: "spellSaveDc", value: 1 },
        { stat: "initiative", value: 1 },
      ]),
    ).toEqual([
      {
        value: 1,
        targets: [
          { kind: "stat", id: "armorClass" },
          { kind: "stat", id: "spellSaveDc" },
          { kind: "stat", id: "initiative" },
        ],
      },
    ]);

    expect(bonusFactsOf([])).toEqual([]);
  });

  it("разные числа — разные прибавки, каждая на месте первой своей величины", () => {
    expect(
      bonusFactsOf([
        { stat: "armorClass", value: 2 },
        { stat: "spellSaveDc", value: 1 },
        { stat: "spellAttackModifier", value: 2 },
        { stat: "initiative", value: 1 },
      ]),
    ).toEqual([
      {
        value: 2,
        targets: [
          { kind: "stat", id: "armorClass" },
          { kind: "stat", id: "spellAttackModifier" },
        ],
      },
      {
        value: 1,
        targets: [
          { kind: "stat", id: "spellSaveDc" },
          { kind: "stat", id: "initiative" },
        ],
      },
    ]);
  });
});
