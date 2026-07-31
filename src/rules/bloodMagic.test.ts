import { describe, expect, it } from "vitest";

import { RulesError } from "./abilities";
import {
  applyExchangeToHitPoints,
  ascensionTierRate,
  bloodMagicAvailable,
  exchangeForSpellLevel,
  exchangeHitPoints,
  hitPointCost,
  maximumRecoveryPerHour,
  regenerationApplies,
  regenerationPerTurn,
  spellPointCost,
  sunSaveDc,
  traitsSuppressed,
  woundsFromExchange,
} from "./bloodMagic";

const THORNE_LEVEL = 7;
const calm = { firedUpon: false, underDirectSunlight: false };

describe("ascensionTierRate", () => {
  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [7, 3],
    [8, 3],
    [9, 4],
    [12, 4],
    [13, 5],
    [16, 5],
    [17, 6],
    [20, 6],
  ])("уровень %i даёт курс %i хитов за очко", (level, expected) => {
    expect(ascensionTierRate(level)).toBe(expected);
  });

  it.each([0, 21, 7.5])("отклоняет уровень %s", (level) => {
    expect(() => ascensionTierRate(level)).toThrow(RulesError);
  });
});

describe("spellPointCost", () => {
  it.each([
    [1, 2],
    [2, 3],
    [3, 5],
    [4, 6],
    [5, 7],
  ])("заклинание %i уровня стоит %i очков", (spellLevel, expected) => {
    expect(spellPointCost(spellLevel)).toBe(expected);
  });

  it.each([0, 6, 9])("отклоняет уровень заклинания %i", (spellLevel) => {
    expect(() => spellPointCost(spellLevel)).toThrow(RulesError);
  });
});

describe("hitPointCost для Торна", () => {
  // Таблица из FR-171: курс 3 хита за очко на 7 уровне.
  it.each([
    [1, 6],
    [2, 9],
    [3, 15],
    [4, 18],
  ])("заклинание %i уровня стоит %i хитов", (spellLevel, expected) => {
    expect(hitPointCost(spellLevel, THORNE_LEVEL)).toBe(expected);
  });

  it("на первой ступени то же заклинание дешевле", () => {
    expect(hitPointCost(1, 3)).toBe(4);
    expect(hitPointCost(3, 3)).toBe(10);
  });

  it("на последней ступени дороже", () => {
    expect(hitPointCost(4, 20)).toBe(36);
  });
});

describe("exchangeHitPoints", () => {
  it("даёт целые очки и не тратит остаток", () => {
    expect(exchangeHitPoints(10, THORNE_LEVEL)).toEqual({
      hitPointsSpent: 9,
      pointsCreated: 3,
      remainderIgnored: 1,
    });
  });

  it("тратит всё без остатка при кратном количестве", () => {
    expect(exchangeHitPoints(9, THORNE_LEVEL)).toEqual({
      hitPointsSpent: 9,
      pointsCreated: 3,
      remainderIgnored: 0,
    });
  });

  it("не даёт очков, если хитов меньше курса", () => {
    expect(exchangeHitPoints(2, THORNE_LEVEL)).toEqual({
      hitPointsSpent: 0,
      pointsCreated: 0,
      remainderIgnored: 2,
    });
  });

  it.each([-1, 1.5])("отклоняет количество хитов %s", (hitPoints) => {
    expect(() => exchangeHitPoints(hitPoints, THORNE_LEVEL)).toThrow(RulesError);
  });
});

describe("exchangeForSpellLevel", () => {
  it("считает точный обмен под заклинание третьего уровня", () => {
    expect(exchangeForSpellLevel(3, THORNE_LEVEL)).toEqual({
      hitPointsSpent: 15,
      pointsCreated: 5,
      remainderIgnored: 0,
    });
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
    expect(() => woundsFromExchange(-1)).toThrow(RulesError);
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
    expect(() => regenerationPerTurn(0)).toThrow(RulesError);
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
    const exchange = exchangeForSpellLevel(3, THORNE_LEVEL);
    expect(applyExchangeToHitPoints(before, exchange)).toEqual({ current: 25, maximum: 39 });
  });

  it("не мутирует исходное состояние", () => {
    const before = { current: 40, maximum: 54 };
    applyExchangeToHitPoints(before, exchangeForSpellLevel(1, THORNE_LEVEL));
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
    expect(() => sunSaveDc(-1)).toThrow(RulesError);
  });
});
