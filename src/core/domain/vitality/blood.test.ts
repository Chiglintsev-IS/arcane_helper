import { DomainError } from "@/core/domain/shared/errors";
import { describe, expect, it } from "vitest";

import {
  FIRE_SUPPRESSION_TURN_STARTS,
  LONG_REST_HOURS,
  maximumRecoveryPerHour,
  maximumReductionAfterHours,
  regenerationPerTurn,
  suppressedByFire,
  traitsSuppressed,
  woundsWarningRu,
} from "@/core/domain/vitality/blood";

const THORNE_LEVEL = 7;

describe("предупреждение о ранах", () => {
  it.each([
    [0, "1 рана"],
    [2, "1 рана"],
    [3, "2 раны"],
    [5, "2 раны"],
    [6, "3 раны"],
  ])("цена в %i единиц даёт %s", (points, expected) => {
    expect(woundsWarningRu(points)).toBe(
      "Хиты уйдут в ноль: 1 рана за сам факт и ещё по 1 за каждые три единицы цены —" +
        ` итого ${expected}`,
    );
  });

  it("отклоняет некорректную цену", () => {
    expect(() => woundsWarningRu(-1)).toThrow(DomainError);
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
    [{ firedUponTurnStarts: 0, underDirectSunlight: false }, false],
    [{ firedUponTurnStarts: FIRE_SUPPRESSION_TURN_STARTS, underDirectSunlight: false }, true],
    [{ firedUponTurnStarts: 0, underDirectSunlight: true }, true],
    [{ firedUponTurnStarts: FIRE_SUPPRESSION_TURN_STARTS, underDirectSunlight: true }, true],
  ])("состояние %o подавляет: %s", (state, expected) => {
    expect(traitsSuppressed(state)).toBe(expected);
  });

  it("неотмеренный остаток срока подавляет так же, как целый срок", () => {
    expect(suppressedByFire({ firedUponTurnStarts: 1, underDirectSunlight: false })).toBe(true);
    expect(suppressedByFire({ firedUponTurnStarts: 0, underDirectSunlight: false })).toBe(false);
  });
});
