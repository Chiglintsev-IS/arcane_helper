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
  it("равная прибавка всем спасброскам — один факт, неполная и неравная — перечень", () => {
    // Плащ защиты: КД остаётся своим фактом, шесть спасбросков становятся одним и стоят на месте
    // первого из них — порядок прибавок свёртка не переставляет.
    expect(bonusFactsOf([{ stat: "armorClass", value: 1 }, ...ALL_SAVES])).toEqual([
      { kind: "stat", id: "armorClass", value: 1 },
      { kind: "family", id: "saves", value: 1 },
    ]);

    // Названы не все шесть — имени у целого нет, и каждая величина остаётся своим фактом.
    expect(bonusFactsOf(ALL_SAVES.slice(0, 3))).toEqual([
      { kind: "stat", id: "save:strength", value: 1 },
      { kind: "stat", id: "save:dexterity", value: 1 },
      { kind: "stat", id: "save:constitution", value: 1 },
    ]);

    // Недостача первой величины семейства значит ровно то же, что недостача любой другой.
    expect(bonusFactsOf(ALL_SAVES.slice(1))).toHaveLength(5);

    // Числа разные — прибавка не одна, а шесть, и назвать её одной значило бы соврать про пять.
    expect(
      bonusFactsOf([...ALL_SAVES.slice(0, 5), { stat: "save:charisma", value: 2 }]),
    ).toHaveLength(6);

    expect(bonusFactsOf([])).toEqual([]);
  });
});
