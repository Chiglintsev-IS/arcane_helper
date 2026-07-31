import { describe, expect, it } from "vitest";

import { RulesError } from "./abilities";
import { concentrationCheckDc, describeConcentrationCheck } from "./concentration";

describe("concentrationCheckDc", () => {
  // Таблица из docs/rules-engine.md — граница проходит между 21 и 22.
  it.each([
    [0, 10],
    [1, 10],
    [12, 10],
    [19, 10],
    [20, 10],
    [21, 10],
    [22, 11],
    [23, 11],
    [40, 20],
    [99, 49],
  ])("урон %i даёт КС %i", (damage, expected) => {
    expect(concentrationCheckDc(damage)).toBe(expected);
  });

  it.each([-1, 3.5, Number.NaN])("отклоняет недопустимый урон %s", (damage) => {
    expect(() => concentrationCheckDc(damage)).toThrow(RulesError);
  });
});

describe("describeConcentrationCheck", () => {
  it("описывает спасбросок Телосложения с КС и модификатором", () => {
    expect(describeConcentrationCheck(30, 2)).toEqual({
      ability: "CON",
      dc: 15,
      modifier: 2,
      hasAdvantage: false,
    });
  });

  it("отмечает преимущество от «Боевого заклинателя»", () => {
    expect(describeConcentrationCheck(10, -1, { hasAdvantage: true })).toEqual({
      ability: "CON",
      dc: 10,
      modifier: -1,
      hasAdvantage: true,
    });
  });

  it("отклоняет нецелый модификатор", () => {
    expect(() => describeConcentrationCheck(10, 1.5)).toThrow(RulesError);
  });
});
