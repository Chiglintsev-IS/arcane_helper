import { describe, expect, it } from "vitest";

import { ARCANA_FIELDS } from "@/core/domain/arcana/schema";

describe("ячейки заклинаний", () => {
  it("отклоняет остаток выше максимума", () => {
    expect(
      ARCANA_FIELDS.spellSlots.safeParse({ 1: { maximum: 4, remaining: 5 } }).success,
    ).toBe(false);
  });

  it("допускает отрицательный остаток: долг после «Применить всё равно»", () => {
    expect(ARCANA_FIELDS.spellSlots.safeParse({ 1: { maximum: 4, remaining: -1 } }).success).toBe(true);
  });

  it("отклоняет уровень ячейки вне 1…9", () => {
    expect(ARCANA_FIELDS.spellSlots.safeParse({ 0: { maximum: 1, remaining: 1 } }).success).toBe(false);
    expect(ARCANA_FIELDS.spellSlots.safeParse({ 10: { maximum: 1, remaining: 1 } }).success).toBe(false);
  });
});

