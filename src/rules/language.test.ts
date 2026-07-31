import { describe, expect, it } from "vitest";

import { longCastingTimeRu, plural, SAVING_THROW_NAMES, withPlural } from "./language";

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
