import { DomainError } from "@/core/domain/shared/errors";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

import {
  averagePerHitDie,
  hitDiceHealing,
  hitDiceRegainedOnLongRest,
  hitDiceRollRange,
  isPossibleHitDiceRoll,
  maximumHitDiceForCast,
} from "@/core/domain/vitality/hitDice";

describe("возврат костей хитов долгим отдыхом (FR-134)", () => {
  it("возвращает половину, округляя вниз", () => {
    expect(hitDiceRegainedOnLongRest(7)).toBe(3);
    expect(hitDiceRegainedOnLongRest(8)).toBe(4);
  });

  it("одну кость возвращает всегда: округление вниз не должно давать ноль", () => {
    expect(hitDiceRegainedOnLongRest(1)).toBe(1);
  });

  it("отказывает бессмысленному числу костей", () => {
    expect(() => hitDiceRegainedOnLongRest(0)).toThrow(DomainError);
    expect(() => hitDiceRegainedOnLongRest(2.5)).toThrow(DomainError);
  });
});

describe("кости хитов Торна", () => {
  it("одна за уровень, размер по классу волшебника", () => {
    const thorne = createThorne();
    expect(thorne.hitDice).toEqual({ total: thorne.level, size: 6, remaining: thorne.level });
  });
});

describe("сколько костей даёт бросить заклинание (FR-135)", () => {
  const cost = { maximumDice: 2, extraDicePerSlotLevel: 2, addsSpellcastingModifier: true };

  it("ячейкой своего уровня даёт базовое число", () => {
    expect(maximumHitDiceForCast(cost, 2, 2, 7)).toBe(2);
  });

  it("каждый уровень ячейки выше добавляет свои кости", () => {
    expect(maximumHitDiceForCast(cost, 2, 3, 7)).toBe(4);
    expect(maximumHitDiceForCast(cost, 2, 4, 7)).toBe(6);
  });

  it("остаток режет сверху: нельзя бросить больше, чем есть", () => {
    expect(maximumHitDiceForCast(cost, 2, 4, 2)).toBe(2);
  });

  it("без неистраченных костей бросать нечего", () => {
    expect(maximumHitDiceForCast(cost, 2, 2, 0)).toBe(0);
  });

  it("ячейка ниже уровня заклинания не уменьшает базовое число", () => {
    expect(maximumHitDiceForCast(cost, 2, 1, 7)).toBe(2);
  });

  it("заклинание без роста от ячейки не растёт", () => {
    const flat = { maximumDice: 3, extraDicePerSlotLevel: 0, addsSpellcastingModifier: false };
    expect(maximumHitDiceForCast(flat, 1, 4, 7)).toBe(3);
  });
});

describe("лечение по брошенным костям (FR-135, ADR-0021)", () => {
  const cost = { maximumDice: 2, extraDicePerSlotLevel: 2, addsSpellcastingModifier: true };

  it("прибавляет модификатор один раз, сколько бы костей ни бросили", () => {
    expect(hitDiceHealing(cost, 9, 4)).toBe(13);
  });

  it("заклинание без модификатора лечит ровно на выпавшее", () => {
    expect(hitDiceHealing({ ...cost, addsSpellcastingModifier: false }, 9, 4)).toBe(9);
  });
});

describe("hitDiceRollRange", () => {
  it("от числа костей до числа костей на грань", () => {
    expect(hitDiceRollRange(2, 6)).toEqual({ minimum: 2, maximum: 12 });
  });

  it.each([0, -1, 1.5])("отклоняет число костей %s", (count) => {
    expect(() => hitDiceRollRange(count, 6)).toThrow(DomainError);
  });

  it.each([0, -6, 6.5])("отклоняет грань %s", (size) => {
    expect(() => hitDiceRollRange(2, size)).toThrow(DomainError);
  });
});

describe("isPossibleHitDiceRoll", () => {
  it("границы диапазона возможны", () => {
    expect(isPossibleHitDiceRoll(2, 2, 6)).toBe(true);
    expect(isPossibleHitDiceRoll(12, 2, 6)).toBe(true);
  });

  it("меньше числа костей и больше их суммы — невозможно", () => {
    expect(isPossibleHitDiceRoll(1, 2, 6)).toBe(false);
    expect(isPossibleHitDiceRoll(13, 2, 6)).toBe(false);
  });
});

describe("averagePerHitDie", () => {
  it.each([
    [6, 4],
    [8, 5],
    [12, 7],
  ])("у d%i среднее за уровень %i", (size, expected) => {
    expect(averagePerHitDie(size)).toBe(expected);
  });

  it.each([0, -6, 6.5])("отклоняет грань %s", (size) => {
    expect(() => averagePerHitDie(size)).toThrow(DomainError);
  });
});
