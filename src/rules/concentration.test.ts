import { describe, expect, it } from "vitest";

import { RulesError } from "./abilities";
import { concentrationCheckDc, describeConcentrationCheck, durationWithRoundsRu, startRound } from "./concentration";

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

describe("startRound", () => {
  const marks = [
    { at: "2026-07-31T18:00:00.000Z", kind: "turn_started" },
    { at: "2026-07-31T18:00:01.000Z", kind: "spell_cast" },
    { at: "2026-07-31T18:00:02.000Z", kind: "turn_started" },
    { at: "2026-07-31T18:00:03.000Z", kind: "turn_started" },
  ];

  it("считает начавшиеся ходы до времени начала эффекта", () => {
    expect(startRound(marks, "2026-07-31T18:00:02.500Z")).toEqual({
      round: 2,
      approximate: false,
    });
  });

  it("учитывает ход, начавшийся тем же мгновением", () => {
    expect(startRound(marks, "2026-07-31T18:00:02.000Z")).toEqual({
      round: 2,
      approximate: false,
    });
  });

  it("даёт первый раунд, пока ни один ход не отмечен", () => {
    expect(startRound([{ at: "2026-07-31T18:00:01.000Z", kind: "spell_cast" }], "2026-07-31T18:00:01.000Z")).toEqual({
      round: 1,
      approximate: false,
    });
  });

  it("помечает число неточным, если начало вытеснено из журнала", () => {
    expect(startRound(marks, "2026-07-31T17:00:00.000Z")).toEqual({
      round: 1,
      approximate: true,
    });
  });

  it("помечает число неточным при пустом журнале: состояние импортировано", () => {
    expect(startRound([], "2026-07-31T18:00:00.000Z")).toEqual({ round: 1, approximate: true });
  });
});

describe("durationWithRoundsRu", () => {
  it.each([
    [{ type: "rounds", value: 3 } as const, "3 раунда"],
    [{ type: "rounds", value: 1 } as const, "1 раунд"],
    [{ type: "minutes", value: 10 } as const, "10 минут (100 раундов)"],
    [{ type: "minutes", value: 1 } as const, "1 минута (10 раундов)"],
    [{ type: "hours", value: 1 } as const, "1 час (600 раундов)"],
    [{ type: "special" } as const, "особая длительность"],
    [{ type: "minutes" } as const, "0 минут (0 раундов)"],
  ])("%o читается как «%s»", (duration, expected) => {
    expect(durationWithRoundsRu(duration)).toBe(expected);
  });
});
