import { describe, expect, it } from "vitest";

import { developmentCheck, developmentOutcome } from "./development";

const THORNE = { proficiencyBonus: 3, abilityModifier: 4 };

describe("проверка разработки", () => {
  it("к модификатору характеристики прибавляется бонус мастерства", () => {
    expect(developmentCheck(THORNE)).toEqual({ bonus: 7 });
  });

  it("выпавшее сравнивается со сложностью, а невозможное отвергается с причиной", () => {
    const check = developmentCheck(THORNE);

    expect(developmentOutcome({ rolled: 8, mishapRolled: undefined, check, difficulty: 15 })).toEqual(
      { rolled: 8, bonus: 7, total: 15, success: true, rewarded: false },
    );
    expect(developmentOutcome({ rolled: 7, mishapRolled: undefined, check, difficulty: 15 })).toEqual(
      { rolled: 7, bonus: 7, total: 14, success: false, rewarded: false },
    );

    for (const rolled of [0, 21, 2.5]) {
      expect(() =>
        developmentOutcome({ rolled, mishapRolled: undefined, check, difficulty: 15 }),
      ).toThrow(/На d20 столько не выпадает/);
    }
  });

  it("натуральная двадцать награждает только успешный результат", () => {
    const check = developmentCheck(THORNE);

    expect(
      developmentOutcome({ rolled: 20, mishapRolled: undefined, check, difficulty: 20 }).rewarded,
    ).toBe(true);
    expect(
      developmentOutcome({ rolled: 20, mishapRolled: undefined, check, difficulty: 30 }).rewarded,
    ).toBe(false);
  });

  it("натуральная единица требует кости последствий и называет его таблицей", () => {
    const check = developmentCheck(THORNE);

    expect(() =>
      developmentOutcome({ rolled: 1, mishapRolled: undefined, check, difficulty: 5 }),
    ).toThrow(/назовите выпавшее на d6/);

    const gone = developmentOutcome({ rolled: 1, mishapRolled: 2, check, difficulty: 5 });
    expect(gone).toEqual({
      rolled: 1,
      bonus: 7,
      total: 8,
      success: false,
      rewarded: false,
      mishapRu: "Реакция гаснет без дополнительных последствий.",
    });

    expect(
      developmentOutcome({ rolled: 1, mishapRolled: 6, check, difficulty: 5 }).mishapRu,
    ).toContain("Повреждается оборудование");

    expect(() => developmentOutcome({ rolled: 1, mishapRolled: 7, check, difficulty: 5 })).toThrow(
      /На d6 столько не выпадает/,
    );
  });
});
