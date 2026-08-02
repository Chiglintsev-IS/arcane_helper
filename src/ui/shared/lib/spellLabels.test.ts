import { describe, expect, it } from "vitest";

import { resolutionBadge } from "@/ui/shared/lib/spellLabels";

/** Числа Торна: оба включают +1 от предмета, и книга их не знает. */
const THORNE = { spellSaveDc: 16, spellAttackModifier: 8 };

describe("resolutionBadge (FR-211)", () => {
  it("все три способа устроены одной схемой: название проверки и число", () => {
    expect(resolutionBadge({ type: "spell_attack" }, THORNE).label).toBe("Атака d20+8");
    // В книге Торна спасбросковых заклинаний пока нет: значок проверяется на данных напрямую,
    // иначе он появится в приложении непроверенным вместе с первой карточкой 2 уровня.
    expect(resolutionBadge({ type: "saving_throw", savingThrow: "DEX" }, THORNE).label).toBe(
      "Спасбросок Ловкости КС 16",
    );
    expect(resolutionBadge({ type: "automatic" }, THORNE).label).toBe("Без броска");
  });

  it("числа берутся у персонажа, а не из книги", () => {
    const novice = { spellSaveDc: 13, spellAttackModifier: 5 };
    expect(resolutionBadge({ type: "spell_attack" }, novice).label).toBe("Атака d20+5");
    expect(resolutionBadge({ type: "saving_throw", savingThrow: "CON" }, novice).label).toBe(
      "Спасбросок Телосложения КС 13",
    );
  });

  it("отрицательный модификатор печатается тем же минусом, что на листе", () => {
    expect(resolutionBadge({ type: "spell_attack" }, { spellSaveDc: 9, spellAttackModifier: -1 }).label).toBe(
      "Атака d20−1",
    );
  });

  it("кто бросает, отвечает иконка, а не цвет: тона значок не несёт", () => {
    const attack = resolutionBadge({ type: "spell_attack" }, THORNE);
    const save = resolutionBadge({ type: "saving_throw", savingThrow: "DEX" }, THORNE);
    const none = resolutionBadge({ type: "automatic" }, THORNE);

    expect([attack.icon, save.icon, none.icon]).toEqual(["✶", "◇", "○"]);
    expect(Object.keys(attack)).toEqual(["label", "icon"]);
  });
});
