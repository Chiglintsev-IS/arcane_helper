import { describe, expect, it } from "vitest";

import { longCastingTimeRu, plural, SAVING_THROW_NAMES, signed, timeSpanAccusativeRu, withPlural } from "@/core/shared/language";

const POINTS: [string, string, string] = ["очко", "очка", "очков"];

describe("plural", () => {
  it.each([
    [1, "очко"],
    [2, "очка"],
    [4, "очка"],
    [5, "очков"],
    [11, "очков"],
    [14, "очков"],
    [21, "очко"],
    [22, "очка"],
    [25, "очков"],
    [0, "очков"],
  ])("%i — %s", (count, expected) => {
    expect(plural(count, POINTS)).toBe(expected);
  });

  it("отрицательное число берёт форму по модулю: остаток тоже бывает в минусе", () => {
    expect(plural(-1, POINTS)).toBe("очко");
  });
});

describe("withPlural", () => {
  it("склеивает число со словом", () => {
    expect(withPlural(6, ["хит", "хита", "хитов"])).toBe("6 хитов");
  });
});

describe("longCastingTimeRu (FR-033)", () => {
  it.each([
    ["minute" as const, 1, "1 минута"],
    ["minute" as const, 10, "10 минут"],
    ["hour" as const, 1, "1 час"],
    ["hour" as const, 8, "8 часов"],
  ])("%s %i — %s", (unit, value, expected) => {
    expect(longCastingTimeRu(unit, value)).toBe(expected);
  });
});

describe("SAVING_THROW_NAMES", () => {
  it("называет характеристику в родительном падеже полным словом", () => {
    expect(SAVING_THROW_NAMES.CON).toBe("Телосложения");
    expect(SAVING_THROW_NAMES.DEX).toBe("Ловкости");
  });
});

describe("timeSpanAccusativeRu: винительный падеж (FR-014)", () => {
  it("минута склоняется: «держится 1 минуту», а не «1 минута»", () => {
    expect(timeSpanAccusativeRu("minute", 1)).toBe("1 минуту");
    expect(timeSpanAccusativeRu("minute", 2)).toBe("2 минуты");
    expect(timeSpanAccusativeRu("minute", 10)).toBe("10 минут");
  });

  it("час и раунд в винительном совпадают с именительным", () => {
    expect(timeSpanAccusativeRu("hour", 1)).toBe("1 час");
    expect(timeSpanAccusativeRu("hour", 8)).toBe("8 часов");
    expect(timeSpanAccusativeRu("round", 1)).toBe("1 раунд");
    expect(timeSpanAccusativeRu("round", 3)).toBe("3 раунда");
  });
});

describe("signed", () => {
  it("знак ставится всегда: «d20+8» произносят вслух именно так", () => {
    expect(signed(8)).toBe("+8");
    expect(signed(0)).toBe("+0");
  });

  it("минус типографский: дефис в этой позиции читается как перенос", () => {
    expect(signed(-2)).toBe("−2");
    expect(signed(-11)).toBe("−11");
  });
});
