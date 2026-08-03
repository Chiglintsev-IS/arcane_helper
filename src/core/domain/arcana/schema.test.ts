import { describe, expect, it } from "vitest";

import { spellSlotsSchema } from "@/core/domain/arcana/schema";

describe("ячейки заклинаний", () => {
  it("отклоняет остаток выше максимума", () => {
    expect(
      spellSlotsSchema.safeParse({ 1: { maximum: 4, remaining: 5 } }).success,
    ).toBe(false);
  });

  it("допускает отрицательный остаток: долг после «Применить всё равно»", () => {
    expect(spellSlotsSchema.safeParse({ 1: { maximum: 4, remaining: -1 } }).success).toBe(true);
  });

  it("отклоняет уровень ячейки вне 1…9", () => {
    expect(spellSlotsSchema.safeParse({ 0: { maximum: 1, remaining: 1 } }).success).toBe(false);
    expect(spellSlotsSchema.safeParse({ 10: { maximum: 1, remaining: 1 } }).success).toBe(false);
  });
});

