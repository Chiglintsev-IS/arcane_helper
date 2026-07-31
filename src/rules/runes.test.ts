import { describe, expect, it } from "vitest";

import { RulesError } from "./abilities";
import { RUNES, RUNE_LABEL, runeEffect } from "./runes";

describe("runeEffect (FR-152)", () => {
  it.each([
    [1, "5 временных хитов"],
    [2, "10 временных хитов"],
    [4, "20 временных хитов"],
  ])("руна жизни на ячейке %s даёт %s", (slotLevel, expected) => {
    expect(runeEffect("life", slotLevel)).toContain(expected);
  });

  it("руна войны округляет половину уровня вверх и не опускается ниже +1", () => {
    expect(runeEffect("war", 1)).toContain("+1");
    expect(runeEffect("war", 2)).toContain("+1");
    expect(runeEffect("war", 3)).toContain("+2");
    expect(runeEffect("war", 4)).toContain("+2");
  });

  it("руна ветра даёт пять футов за уровень ячейки", () => {
    expect(runeEffect("wind", 1)).toContain("+5 футов");
    expect(runeEffect("wind", 4)).toContain("+20 футов");
  });

  it("каждая руна названа словами и даёт непустой эффект", () => {
    for (const rune of RUNES) {
      expect(RUNE_LABEL[rune], rune).toBeTruthy();
      expect(runeEffect(rune, 1).length, rune).toBeGreaterThan(10);
    }
  });

  it("уровень вне диапазона ячеек — ошибка, а не выдуманное число", () => {
    expect(() => runeEffect("life", 0)).toThrow(RulesError);
    expect(() => runeEffect("life", 10)).toThrow(RulesError);
    expect(() => runeEffect("life", 1.5)).toThrow(RulesError);
  });
});
