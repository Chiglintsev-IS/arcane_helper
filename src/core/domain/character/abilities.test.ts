import { DomainError } from "@/core/domain/shared/errors";
import { describe, expect, it } from "vitest";

import {
  abilityModifier,
  initiativeModifier,
  passivePerception,
  preparedLimit,
  proficiencyBonus,
  savingThrowModifier,
  skillModifier,
  spellAttackModifier,
  spellSaveDc,
} from "@/core/domain/character/abilities";

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
    expect(() => proficiencyBonus(level)).toThrow(DomainError);
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
    expect(() => abilityModifier(18.5)).toThrow(DomainError);
  });
});

describe("производные характеристики Торна", () => {
  const level = 7;
  const proficiency = 3;
  const intelligence = 18;

  it("КС спасброска без прибавки предмета равна 15", () => {
    expect(spellSaveDc({ proficiencyBonus: proficiency, score: intelligence })).toBe(15);
  });

  it("модификатор атаки заклинанием без прибавки предмета равен +7", () => {
    expect(spellAttackModifier({ proficiencyBonus: proficiency, score: intelligence})).toBe(
      7,
    );
  });

  it("лимит подготовки равен 11", () => {
    expect(preparedLimit(intelligence, level)).toBe(11);
  });
});

describe("производные числа листа", () => {
  it("спасбросок: модификатор и владение", () => {
    expect(
      savingThrowModifier({ score: 16, proficient: false, proficiencyBonus: 3 }),
    ).toBe(3);
    expect(
      savingThrowModifier({ score: 18, proficient: true, proficiencyBonus: 3 }),
    ).toBe(7);
  });

  it("навык: без владения, с владением, с компетентностью", () => {
    expect(skillModifier({ score: 18, training: undefined, proficiencyBonus: 3 })).toBe(4);
    expect(skillModifier({ score: 18, training: "proficient", proficiencyBonus: 3 })).toBe(7);
    expect(skillModifier({ score: 18, training: "expert", proficiencyBonus: 3 })).toBe(10);
  });

  it("пассивная внимательность — десять плюс навык Внимательности", () => {
    expect(passivePerception(skillModifier({ score: 12, training: undefined, proficiencyBonus: 3 }))).toBe(11);
  });

  it("инициатива — половина суммы модификаторов Ловкости и Мудрости", () => {
    expect(initiativeModifier({ dexterity: 14, wisdom: 12 })).toBe(1);
    expect(initiativeModifier({ dexterity: 14, wisdom: 14 })).toBe(2);
    expect(initiativeModifier({ dexterity: 8, wisdom: 6 })).toBe(-2);
  });

  it("КС и атака считаются от бонуса мастерства и характеристики: вещей формула не знает", () => {
    expect(spellSaveDc({ proficiencyBonus: 3, score: 18 })).toBe(15);
    expect(spellAttackModifier({ proficiencyBonus: 3, score: 18 })).toBe(7);
  });
});

describe("preparedLimit", () => {
  it("растёт вместе с уровнем и Интеллектом", () => {
    expect(preparedLimit(16, 1)).toBe(4);
    expect(preparedLimit(20, 20)).toBe(25);
  });

  it("нижнего предела формула не знает: он свойство величины и применяется после вкладов", () => {
    expect(preparedLimit(6, 1)).toBe(-1);
  });

  it("отклоняет уровень вне диапазона", () => {
    expect(() => preparedLimit(18, 0)).toThrow(DomainError);
  });
});
