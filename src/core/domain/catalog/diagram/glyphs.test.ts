import { describe, expect, it } from "vitest";

import { GLYPHS, GLYPH_IDS, SEALS, SEAL_KINDS } from "@/core/domain/catalog/diagram/glyphs";
import { BOX, type Stroke } from "@/core/domain/catalog/diagram/strokes";
import { FULL_FUTHARK, RUNES, RUNE_BY_CHAR, RUNE_IDS, isRune } from "@/core/domain/catalog/diagram/futhark";

/** Все координаты штриха: любой знак обязан жить в своём боксе. */
function coordinates(stroke: Stroke): number[] {
  if (stroke.kind === "circle") return [stroke.cx, stroke.cy, stroke.cx + stroke.r, stroke.cy + stroke.r];
  if (stroke.kind === "line") return [stroke.x1, stroke.y1, stroke.x2, stroke.y2];
  if (stroke.kind === "arc") return [stroke.cx - stroke.r, stroke.cy - stroke.r, stroke.cx + stroke.r, stroke.cy + stroke.r];
  return stroke.points.flatMap(([x, y]) => [x, y]);
}

describe("старший футарк", () => {
  it("содержит все 24 руны", () => {
    expect(RUNE_IDS).toHaveLength(24);
    expect(new Set(RUNE_IDS).size).toBe(24);
  });

  it("у каждой руны есть символ и хотя бы один штрих", () => {
    for (const id of RUNE_IDS) {
      expect(RUNES[id].char, id).toHaveLength(1);
      expect(RUNES[id].strokes.length, id).toBeGreaterThan(0);
    }
  });

  it("символы уникальны и узнаются", () => {
    expect(RUNE_BY_CHAR.size).toBe(24);
    expect(isRune("ᚨ")).toBe(true);
    expect(isRune("ж")).toBe(false);
  });

  it("полный футарк — строка из 24 рун", () => {
    expect([...FULL_FUTHARK]).toHaveLength(24);
  });
});

describe("знаки и печати", () => {
  it("каждый знак словаря нарисован", () => {
    for (const id of GLYPH_IDS) {
      expect(GLYPHS[id].length, id).toBeGreaterThan(0);
    }
  });

  it("руны входят в словарь знаков", () => {
    expect(GLYPH_IDS).toContain("rune-ansuz");
    expect(GLYPH_IDS).toContain("saturn");
    expect(GLYPH_IDS).toContain("frost");
  });

  it("огня среди стихий нет: его нет у персонажа (FR-052)", () => {
    expect(GLYPH_IDS as readonly string[]).not.toContain("fire");
  });

  it("все четыре печати нарисованы", () => {
    expect(SEAL_KINDS).toHaveLength(4);
    for (const kind of SEAL_KINDS) {
      expect(SEALS[kind].length, kind).toBeGreaterThan(0);
    }
  });

  it("штрихи не выходят за свой бокс", () => {
    const everything = [...GLYPH_IDS.map((id) => GLYPHS[id]), ...SEAL_KINDS.map((kind) => SEALS[kind])];
    for (const strokes of everything) {
      for (const stroke of strokes) {
        for (const value of coordinates(stroke)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(BOX);
        }
      }
    }
  });
});
