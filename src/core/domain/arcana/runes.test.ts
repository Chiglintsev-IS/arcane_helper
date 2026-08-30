import { DomainError } from "@/core/domain/shared/errors";
import { describe, expect, it } from "vitest";

import {
  lifeRuneTemporaryHitPoints,
  RUNES,
  RUNE_LABEL,
  runeEffect,
  runeTrace,
  runeUnavailability,
} from "@/core/domain/arcana/runes";

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
    expect(() => runeEffect("life", 0)).toThrow(DomainError);
    expect(() => runeEffect("life", 10)).toThrow(DomainError);
    expect(() => runeEffect("life", 1.5)).toThrow(DomainError);
  });
});

describe("временные хиты руны жизни числом (FR-152)", () => {
  it.each([
    [1, 5],
    [2, 10],
    [4, 20],
  ])("на ячейке %s даёт %s", (slotLevel, expected) => {
    expect(lifeRuneTemporaryHitPoints(slotLevel)).toBe(expected);
  });

  it("совпадает с числом, названным мастеру: формула одна", () => {
    for (const slotLevel of [1, 2, 3, 4]) {
      expect(runeEffect("life", slotLevel)).toContain(
        `${lifeRuneTemporaryHitPoints(slotLevel)} временных хитов`,
      );
    }
  });

  it("уровень вне диапазона ячеек — ошибка, а не выдуманное число", () => {
    expect(() => lifeRuneTemporaryHitPoints(0)).toThrow(DomainError);
    expect(() => lifeRuneTemporaryHitPoints(10)).toThrow(DomainError);
  });
});

describe("runeUnavailability", () => {
  it("при уровне сотворения и наличии рун — приложить можно", () => {
    expect(runeUnavailability(1, 2)).toBeNull();
  });

  it("руна при оплате кровью", () => {
    expect(runeUnavailability(3, 2)).toBeNull();
  });

  it("без уровня сотворения руну не приложить", () => {
    expect(runeUnavailability(undefined, 2)).toBe(
      "У заговора и ритуала нет уровня сотворения — руну не приложить",
    );
  });

  it("без рун называет, когда они вернутся", () => {
    expect(runeUnavailability(1, 0)).toBe("Рун не осталось, вернутся долгим отдыхом");
  });
});

describe("runeTrace (FR-334)", () => {
  it("руна жизни следа не оставляет: её оставленное — временные хиты", () => {
    expect(runeTrace("life", 3)).toBeNull();
  });

  it("ветер держится один раунд: срок кончается началом вашего следующего хода", () => {
    const trace = runeTrace("wind", 2);

    expect(trace?.rounds).toBe(1);
    expect(trace?.endConditionRu).toContain("до начала вашего следующего хода");
  });

  it("война держится два раунда: начало вашего следующего хода срок переживает", () => {
    const trace = runeTrace("war", 2);

    expect(trace?.rounds).toBe(2);
    expect(trace?.endConditionRu).toContain("до конца вашего следующего хода");
  });

  it("ветер приносит листу прибавку к скорости, война — ничего", () => {
    expect(runeTrace("wind", 3)?.contributions).toEqual([
      { stat: "speed", kind: "bonus", value: 15 },
    ]);
    expect(runeTrace("war", 3)?.contributions).toEqual([]);
  });

  it("число следа то же, что названо мастеру: формула одна", () => {
    for (const rune of RUNES) {
      const trace = runeTrace(rune, 4);
      if (trace === null) continue;
      expect(runeEffect(rune, 4)).toContain(trace.noteRu);
    }
  });

  it("уровень вне диапазона ячеек — ошибка, а не выдуманный след", () => {
    expect(() => runeTrace("wind", 0)).toThrow(DomainError);
    expect(() => runeTrace("war", 10)).toThrow(DomainError);
  });
});
