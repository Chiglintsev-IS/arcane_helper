import { describe, expect, it } from "vitest";

import {
  abilityModifier,
  baseSpellAttackModifier,
  baseSpellSaveDc,
  preparedLimit,
  proficiencyBonus,
  RulesError,
} from "./abilities";

describe("proficiencyBonus", () => {
  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [7, 3],
    [8, 3],
    [9, 4],
    [13, 5],
    [17, 6],
    [20, 6],
  ])("уровень %i даёт бонус +%i", (level, expected) => {
    expect(proficiencyBonus(level)).toBe(expected);
  });

  it.each([0, 21, 7.5, Number.NaN])("отклоняет недопустимый уровень %s", (level) => {
    expect(() => proficiencyBonus(level)).toThrow(RulesError);
  });
});

describe("abilityModifier", () => {
  it.each([
    [1, -5],
    [8, -1],
    [9, -1],
    [10, 0],
    [11, 0],
    [18, 4],
    [20, 5],
  ])("значение %i даёт модификатор %i", (score, expected) => {
    expect(abilityModifier(score)).toBe(expected);
  });

  it("отклоняет нецелое значение", () => {
    expect(() => abilityModifier(18.5)).toThrow(RulesError);
  });
});

describe("производные характеристики Торна", () => {
  const level = 7;
  const intelligence = 18;

  it("КС спасброска равна 15", () => {
    expect(baseSpellSaveDc(level, intelligence)).toBe(15);
  });

  it("модификатор атаки заклинанием равен +7", () => {
    expect(baseSpellAttackModifier(level, intelligence)).toBe(7);
  });

  it("лимит подготовки равен 11", () => {
    expect(preparedLimit(intelligence, level)).toBe(11);
  });
});

describe("preparedLimit", () => {
  it("растёт вместе с уровнем и Интеллектом", () => {
    expect(preparedLimit(16, 1)).toBe(4);
    expect(preparedLimit(20, 20)).toBe(25);
  });

  it("не опускается ниже одного заклинания при отрицательном модификаторе", () => {
    expect(preparedLimit(6, 1)).toBe(1);
  });

  it("отклоняет уровень вне диапазона", () => {
    expect(() => preparedLimit(18, 0)).toThrow(RulesError);
  });
});
