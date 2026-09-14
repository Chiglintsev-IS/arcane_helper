import { describe, expect, it } from "vitest";

import { developmentCheck, mishapBands } from "./development";

const THORNE = { proficiencyBonus: 3, abilityModifier: 4 };

describe("проверка разработки", () => {
  it("к модификатору характеристики прибавляется бонус мастерства", () => {
    expect(developmentCheck(THORNE)).toEqual({ bonus: 7 });
  });

  it("бросает игрок: приложение называет бонус и не знает исхода", () => {
    expect(Object.keys(developmentCheck(THORNE))).toEqual(["bonus"]);
  });
});

describe("авария", () => {
  it("соседние грани с одним последствием стоят одной строкой справочника", () => {
    const bands = mishapBands();

    expect(bands[0]).toEqual({
      fromRolled: 1,
      toRolled: 2,
      textRu: "Реакция гаснет без дополнительных последствий.",
    });
    expect(bands.at(-1)).toMatchObject({ fromRolled: 6, toRolled: 6 });
  });
});
