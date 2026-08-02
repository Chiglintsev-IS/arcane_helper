import { describe, expect, it } from "vitest";

import {
  areaLabel,
  areaPhrase,
  rangeLabel,
  rangePhrase,
  resolutionBadge,
} from "@/ui/shared/lib/spellLabels";

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

describe("дальность в двух формах", () => {
  it("подписанная строка говорит коротко: ярлык рядом уже ответил, о чём речь", () => {
    expect(rangeLabel({ type: "self" })).toBe("На себя");
    expect(rangeLabel({ type: "touch" })).toBe("Касание");
    expect(rangeLabel({ type: "distance", distanceFeet: 150 })).toBe("150 футов");
    expect(rangeLabel({ type: "special" })).toBe("Особая");
  });

  it("строка без ярлыка называет себя сама: «Особая» одна ничего не говорит", () => {
    expect(rangePhrase({ type: "special" })).toBe("Особая дальность");
    expect(rangePhrase({ type: "distance", distanceFeet: 30 })).toBe("30 футов");
    expect(rangePhrase({ type: "self" })).toBe("На себя");
  });

  it("футы склоняются", () => {
    expect(rangeLabel({ type: "distance", distanceFeet: 1 })).toBe("1 фут");
    expect(rangeLabel({ type: "distance", distanceFeet: 2 })).toBe("2 фута");
  });
});

describe("область в двух формах", () => {
  it("подписанная строка отделяет фигуру от размера запятой", () => {
    expect(areaLabel({ shape: "sphere", sizeFeet: 30 })).toBe("Сфера, 30 футов");
  });

  it("строка без ярлыка добавляет, откуда область считается", () => {
    expect(areaPhrase({ shape: "sphere", sizeFeet: 30 }, true)).toBe("Сфера 30 футов от себя");
    expect(areaPhrase({ shape: "cone", sizeFeet: 15 }, false)).toBe("Конус 15 футов");
  });
});
