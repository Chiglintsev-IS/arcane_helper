import { DomainError } from "@/core/domain/shared/errors";
import { describe, expect, it } from "vitest";

import {
  applyExchangeToHitPoints,
  bloodMagicAvailable,
  exchangeHitPoints,
  LONG_REST_HOURS,
  maximumRecoveryPerHour,
  maximumReductionAfterHours,
  regenerationApplies,
  regenerationPerTurn,
  sunSaveDc,
  traitsSuppressed,
  woundsFromExchange,
} from "@/core/domain/vitality/blood";

const THORNE_RATE = 3; // курс 7-го уровня (Торн)
const THORNE_LEVEL = 7;
const calm = { firedUpon: false, underDirectSunlight: false };

describe("exchangeHitPoints", () => {
  it("даёт целые очки и не тратит остаток", () => {
    expect(exchangeHitPoints(10, THORNE_RATE)).toEqual({
      hitPointsSpent: 9,
      pointsCreated: 3,
      remainderIgnored: 1,
    });
  });

  it("тратит всё без остатка при кратном количестве", () => {
    expect(exchangeHitPoints(9, THORNE_RATE)).toEqual({
      hitPointsSpent: 9,
      pointsCreated: 3,
      remainderIgnored: 0,
    });
  });

  it("не даёт очков, если хитов меньше курса", () => {
    expect(exchangeHitPoints(2, THORNE_RATE)).toEqual({
      hitPointsSpent: 0,
      pointsCreated: 0,
      remainderIgnored: 2,
    });
  });

  it.each([-1, 1.5])("отклоняет количество хитов %s", (hitPoints) => {
    expect(() => exchangeHitPoints(hitPoints, THORNE_RATE)).toThrow(DomainError);
  });
});

describe("woundsFromExchange", () => {
  it.each([
    [0, 1],
    [2, 1],
    [3, 2],
    [5, 2],
    [6, 3],
  ])("%i созданных очков дают %i ран", (points, expected) => {
    expect(woundsFromExchange(points)).toBe(expected);
  });

  it("отклоняет некорректное число очков", () => {
    expect(() => woundsFromExchange(-1)).toThrow(DomainError);
  });
});

describe("регенерация и восстановление максимума", () => {
  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [6, 3],
    [7, 3],
    [9, 4],
    [20, 7],
  ])("на уровне %i восстанавливается %i", (level, expected) => {
    expect(regenerationPerTurn(level)).toBe(expected);
    expect(maximumRecoveryPerHour(level)).toBe(expected);
  });

  it("отклоняет недопустимый уровень", () => {
    expect(() => regenerationPerTurn(0)).toThrow(DomainError);
  });
});

describe("снижённый максимум за несколько часов (FR-173)", () => {
  it("возвращает по три очка за час на уровне Торна", () => {
    expect(maximumReductionAfterHours(24, THORNE_LEVEL, 1)).toBe(21);
    expect(maximumReductionAfterHours(24, THORNE_LEVEL, 2)).toBe(18);
  });

  it("за восемь часов долгого отдыха возвращает 24 очка", () => {
    expect(LONG_REST_HOURS).toBe(8);
    expect(maximumReductionAfterHours(30, THORNE_LEVEL, LONG_REST_HOURS)).toBe(6);
  });

  it("ниже нуля не уходит: вернуть больше утраченного нечего", () => {
    expect(maximumReductionAfterHours(9, THORNE_LEVEL, LONG_REST_HOURS)).toBe(0);
    expect(maximumReductionAfterHours(0, THORNE_LEVEL, LONG_REST_HOURS)).toBe(0);
  });

  it("нулевой час ничего не возвращает", () => {
    expect(maximumReductionAfterHours(9, THORNE_LEVEL, 0)).toBe(9);
  });

  it("отклоняет нецелые и отрицательные аргументы, а не выдумывает число", () => {
    expect(() => maximumReductionAfterHours(-1, THORNE_LEVEL, 1)).toThrow(DomainError);
    expect(() => maximumReductionAfterHours(1.5, THORNE_LEVEL, 1)).toThrow(DomainError);
    expect(() => maximumReductionAfterHours(9, THORNE_LEVEL, -1)).toThrow(DomainError);
    expect(() => maximumReductionAfterHours(9, THORNE_LEVEL, 0.5)).toThrow(DomainError);
    expect(() => maximumReductionAfterHours(9, 0, 1)).toThrow(DomainError);
  });
});

describe("подавление особенностей", () => {
  it.each([
    [{ firedUpon: false, underDirectSunlight: false }, false],
    [{ firedUpon: true, underDirectSunlight: false }, true],
    [{ firedUpon: false, underDirectSunlight: true }, true],
    [{ firedUpon: true, underDirectSunlight: true }, true],
  ])("состояние %o подавляет: %s", (state, expected) => {
    expect(traitsSuppressed(state)).toBe(expected);
    expect(bloodMagicAvailable(state)).toBe(!expected);
  });
});

describe("regenerationApplies", () => {
  it("действует ниже половины максимума", () => {
    expect(regenerationApplies({ current: 20, maximum: 54 }, calm)).toBe(true);
  });

  it("не действует ровно на половине", () => {
    expect(regenerationApplies({ current: 27, maximum: 54 }, calm)).toBe(false);
  });

  it("не действует при нуле хитов", () => {
    expect(regenerationApplies({ current: 0, maximum: 54 }, calm)).toBe(false);
  });

  it("не действует при подавлении огнём", () => {
    expect(
      regenerationApplies({ current: 10, maximum: 54 }, { ...calm, firedUpon: true }),
    ).toBe(false);
  });

  it("не действует под солнцем", () => {
    expect(
      regenerationApplies({ current: 10, maximum: 54 }, { ...calm, underDirectSunlight: true }),
    ).toBe(false);
  });

  it("порог считается от снижённого максимума, а не от исходного", () => {
    // 20 из исходных 54 — ниже половины, но после обмена максимум стал 36, половина — 18.
    expect(regenerationApplies({ current: 20, maximum: 54 }, calm)).toBe(true);
    expect(regenerationApplies({ current: 20, maximum: 36 }, calm)).toBe(false);
  });
});

describe("applyExchangeToHitPoints", () => {
  it("снижает и текущее здоровье, и максимум на потраченное", () => {
    const before = { current: 40, maximum: 54 };
    const exchange = { hitPointsSpent: 15, pointsCreated: 5, remainderIgnored: 0 };
    expect(applyExchangeToHitPoints(before, exchange)).toEqual({ current: 25, maximum: 39 });
  });

  it("не мутирует исходное состояние", () => {
    const before = { current: 40, maximum: 54 };
    applyExchangeToHitPoints(before, { hitPointsSpent: 6, pointsCreated: 3, remainderIgnored: 0 });
    expect(before).toEqual({ current: 40, maximum: 54 });
  });
});

describe("sunSaveDc", () => {
  it.each([
    [0, 10],
    [1, 12],
    [2, 14],
    [5, 20],
  ])("после %i спасбросков КС равна %i", (saves, expected) => {
    expect(sunSaveDc(saves)).toBe(expected);
  });

  it("отклоняет отрицательное число спасбросков", () => {
    expect(() => sunSaveDc(-1)).toThrow(DomainError);
  });
});
