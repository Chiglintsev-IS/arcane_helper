import { describe, expect, it } from "vitest";

import { castingTimeLabel, resolutionBadge, signed } from "./format";

/** Числа Торна: оба включают +1 от предмета, и книга их не знает (OQ-11). */
const THORNE = { spellSaveDc: 16, spellAttackModifier: 8 };

describe("castingTimeLabel (FR-033)", () => {
  it("действие, бонусное действие и реакция называются словом", () => {
    expect(castingTimeLabel({ type: "action" })).toBe("Действие");
    expect(castingTimeLabel({ type: "bonus_action" })).toBe("Бонусное");
    expect(castingTimeLabel({ type: "reaction", reactionTrigger: "в вас попали" })).toBe("Реакция");
  });

  it("минуты и часы называются числом: «1 минута», а не «Минуты»", () => {
    expect(castingTimeLabel({ type: "minute", value: 1 })).toBe("1 минута");
    expect(castingTimeLabel({ type: "minute", value: 10 })).toBe("10 минут");
    expect(castingTimeLabel({ type: "hour", value: 1 })).toBe("1 час");
  });

  it("без числа остаётся категория: врать о времени хуже, чем назвать его приблизительно", () => {
    expect(castingTimeLabel({ type: "minute" })).toBe("Минуты");
  });
});

describe("signed", () => {
  it("знак ставится всегда: «d20+8» произносят вслух именно так", () => {
    expect(signed(8)).toBe("+8");
    expect(signed(0)).toBe("+0");
  });

  it("отрицательный модификатор пишется минусом", () => {
    expect(signed(-2)).toBe("−2");
  });
});

describe("resolutionBadge (FR-211)", () => {
  it("атака называет бросок числом, а не словом «Атака»", () => {
    expect(resolutionBadge({ type: "spell_attack" }, THORNE).label).toBe("d20+8");
  });

  it("спасбросок называет и характеристику, и КС", () => {
    // В книге Торна спасбросковых заклинаний пока нет: значок проверяется на данных напрямую,
    // иначе он появится в приложении непроверенным вместе с первой карточкой 2 уровня.
    expect(resolutionBadge({ type: "saving_throw", savingThrow: "DEX" }, THORNE).label).toBe(
      "Спасбросок Ловкости КС 16",
    );
  });

  it("числа берутся у персонажа, а не из книги", () => {
    const novice = { spellSaveDc: 13, spellAttackModifier: 5 };
    expect(resolutionBadge({ type: "spell_attack" }, novice).label).toBe("d20+5");
    expect(resolutionBadge({ type: "saving_throw", savingThrow: "CON" }, novice).label).toBe(
      "Спасбросок Телосложения КС 13",
    );
  });

  it("без броска остаётся «Без броска»: числа тут нет и выдумывать его нечем", () => {
    expect(resolutionBadge({ type: "automatic" }, THORNE).label).toBe("Без броска");
  });
});
