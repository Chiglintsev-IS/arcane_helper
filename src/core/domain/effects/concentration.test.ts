import { DomainError } from "@/core/domain/shared/errors";
import { describe, expect, it } from "vitest";

import {
  describeConcentrationCheck,
  durationWithRoundsRu,
  startRound,
} from "@/core/domain/effects/concentration";

/** КС читается описанием проверки: своего входа у неё нет, и модификатор здесь ни при чём. */
const dcFor = (damage: number): number => describeConcentrationCheck(damage, 0).dc;

describe("КС проверки концентрации", () => {
  // Таблица из — граница проходит между 21 и 22.
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
    expect(dcFor(damage)).toBe(expected);
  });

  it.each([-1, 3.5, Number.NaN])("отклоняет недопустимый урон %s", (damage) => {
    expect(() => dcFor(damage)).toThrow(DomainError);
  });
});

describe("describeConcentrationCheck", () => {
  it("описывает спасбросок Телосложения с КС и модификатором", () => {
    expect(describeConcentrationCheck(30, 2)).toEqual({
      ability: "CON",
      dc: 15,
      modifier: 2,
      hasAdvantage: false,
      minimumRoll: 13,
    });
  });

  it("отмечает преимущество от «Боевого заклинателя»", () => {
    expect(describeConcentrationCheck(10, -1, { hasAdvantage: true })).toEqual({
      ability: "CON",
      dc: 10,
      modifier: -1,
      hasAdvantage: true,
      minimumRoll: 11,
    });
  });

  it("отклоняет нецелый модификатор", () => {
    expect(() => describeConcentrationCheck(10, 1.5)).toThrow(DomainError);
  });

  it("считает наименьший проходящий бросок", () => {
    expect(describeConcentrationCheck(24, 4).minimumRoll).toBe(8);
    expect(describeConcentrationCheck(10, -1).minimumRoll).toBe(11);
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
  // Предлог «до» требует родительного падежа: «до 3 раунда» читается как ошибка приложения.
  it.each([
    [{ type: "rounds", value: 3 } as const, "до 3 раундов"],
    [{ type: "rounds", value: 1 } as const, "до 1 раунда"],
    // Перевод в раунды помогает, пока их можно пересчитать в уме и сравнить с длиной боя.
    [{ type: "minutes", value: 1 } as const, "до 1 минуты (10 раундов)"],
    [{ type: "minutes", value: 10 } as const, "до 10 минут"],
    [{ type: "hours", value: 1 } as const, "до 1 часа"],
    [{ type: "special" } as const, "особая длительность"],
    [{ type: "minutes" } as const, "до 0 минут (0 раундов)"],
  ])("%o читается как «%s»", (duration, expected) => {
    expect(durationWithRoundsRu(duration)).toBe(expected);
  });
});
