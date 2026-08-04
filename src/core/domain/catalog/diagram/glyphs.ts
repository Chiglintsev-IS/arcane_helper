/**
 * Знаки схемы ритуала: алхимические металлы, стихии, руны — и печати центра.
 *
 * Словарь закрытый: знак вне списка нечем нарисовать, поэтому схема с ним не проходит проверку.
 * Огня в стихиях нет — его нет у персонажа. Молния и мороз добавлены вместо него: это
 * темы Торна.
 */

import { RUNES, RUNE_IDS, type RuneId } from "@/core/domain/catalog/diagram/futhark";
import { line, type Stroke } from "@/core/domain/catalog/diagram/strokes";

/** Семь металлов алхимии: они же планетарные знаки. Порядок — от Сатурна к Луне. */
const METAL_IDS = ["saturn", "jupiter", "mars", "sun", "venus", "mercury", "moon"] as const;

/** Стихии и темы персонажа. */
const ELEMENT_IDS = ["air", "water", "earth", "lightning", "frost"] as const;

export const GLYPH_IDS = [...METAL_IDS, ...ELEMENT_IDS, ...RUNE_IDS] as const;

export type GlyphId = (typeof GLYPH_IDS)[number];

const METALS: Record<(typeof METAL_IDS)[number], Stroke[]> = {
  // ♄ свинец: крюк с перекладиной.
  saturn: [line(30, 24, 30, 70), line(18, 30, 46, 30), { kind: "arc", cx: 48, cy: 70, r: 20, fromDegrees: 180, toDegrees: 20 }],
  // ♃ олово: цифра «4» одним росчерком.
  jupiter: [line(24, 34, 24, 62), line(24, 62, 62, 62), line(52, 30, 52, 84)],
  // ♂ железо: круг со стрелой.
  mars: [
    { kind: "circle", cx: 42, cy: 60, r: 22 },
    line(58, 44, 84, 18),
    line(84, 18, 62, 18),
    line(84, 18, 84, 40),
  ],
  // ☉ золото: круг с точкой.
  sun: [{ kind: "circle", cx: 50, cy: 50, r: 26 }, { kind: "circle", cx: 50, cy: 50, r: 4 }],
  // ♀ медь: круг с крестом.
  venus: [
    { kind: "circle", cx: 50, cy: 36, r: 20 },
    line(50, 56, 50, 88),
    line(34, 74, 66, 74),
  ],
  // ☿ ртуть: рожки, круг, крест.
  mercury: [
    { kind: "arc", cx: 50, cy: 28, r: 14, fromDegrees: 210, toDegrees: 330 },
    { kind: "circle", cx: 50, cy: 52, r: 18 },
    line(50, 70, 50, 92),
    line(38, 82, 62, 82),
  ],
  // ☽ серебро: полумесяц.
  moon: [{ kind: "arc", cx: 62, cy: 50, r: 32, fromDegrees: 40, toDegrees: 320 }],
};

const ELEMENTS: Record<(typeof ELEMENT_IDS)[number], Stroke[]> = {
  // 🜁 воздух: треугольник вверх с перекладиной.
  air: [
    { kind: "polyline", points: [[50, 16], [84, 80], [16, 80]], closed: true },
    line(28, 56, 72, 56),
  ],
  // 🜄 вода: треугольник вниз.
  water: [{ kind: "polyline", points: [[16, 20], [84, 20], [50, 84]], closed: true }],
  // 🜃 земля: треугольник вниз с перекладиной.
  earth: [
    { kind: "polyline", points: [[16, 20], [84, 20], [50, 84]], closed: true },
    line(30, 48, 70, 48),
  ],
  // Молния: тема персонажа, своего алхимического знака у неё нет.
  lightning: [{ kind: "polyline", points: [[58, 10], [32, 48], [52, 48], [26, 90], [70, 42], [48, 42], [66, 10]] }],
  // Мороз: шестилучевая снежинка.
  frost: [
    line(50, 12, 50, 88),
    line(17, 31, 83, 69),
    line(17, 69, 83, 31),
    line(50, 24, 40, 34),
    line(50, 24, 60, 34),
  ],
};

const RUNE_GLYPHS = Object.fromEntries(
  RUNE_IDS.map((id) => [id, RUNES[id].strokes]),
) as Record<RuneId, Stroke[]>;

export const GLYPHS: Record<GlyphId, Stroke[]> = { ...METALS, ...ELEMENTS, ...RUNE_GLYPHS };

/** Печати центра. Порядок штрихов — порядок рисования. */
export const SEAL_KINDS = ["eye", "sphere", "summoning-triangle", "empty-hand"] as const;

export type SealKind = (typeof SEAL_KINDS)[number];

export const SEALS: Record<SealKind, Stroke[]> = {
  // Глаз: миндаль из двух дуг, зрачок, точка.
  eye: [
    { kind: "arc", cx: 50, cy: 50, r: 46, fromDegrees: 60, toDegrees: 120 },
    { kind: "arc", cx: 50, cy: 50, r: 46, fromDegrees: 240, toDegrees: 300 },
    { kind: "circle", cx: 50, cy: 50, r: 16 },
    { kind: "circle", cx: 50, cy: 50, r: 4 },
  ],
  // Сфера: расходящиеся кольца.
  sphere: [
    { kind: "circle", cx: 50, cy: 50, r: 44 },
    { kind: "circle", cx: 50, cy: 50, r: 28 },
    { kind: "circle", cx: 50, cy: 50, r: 12 },
  ],
  // Треугольник вызова: внутри круг — место под уголь и травы.
  "summoning-triangle": [
    { kind: "polyline", points: [[50, 8], [92, 84], [8, 84]], closed: true },
    { kind: "circle", cx: 50, cy: 62, r: 14 },
  ],
  // Пустая рука: контур пунктиром, внутри намеренно ничего.
  "empty-hand": [
    {
      kind: "polyline",
      points: [
        [34, 92], [30, 62], [22, 46], [26, 42], [34, 54], [32, 24], [38, 22], [42, 52],
        [46, 18], [52, 18], [54, 52], [60, 26], [66, 28], [62, 58], [70, 46], [74, 50],
        [66, 66], [66, 92],
      ],
      closed: true,
      dashed: true,
    },
  ],
};
