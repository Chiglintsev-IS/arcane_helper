/**
 * Старший футарк: 24 руны отрезками.
 *
 * Рисуются собственными путями, а не текстом: шрифта с рунным блоком на устройстве может не
 * оказаться, а схема должна выглядеть одинаково всегда — по ней рисуют. Символ Unicode хранится
 * рядом, чтобы надписи в JSON контента читались глазом.
 */

import { line, stem, type Stroke } from "@/core/domain/catalog/diagram/strokes";

export const RUNE_IDS = [
  "rune-fehu",
  "rune-uruz",
  "rune-thurisaz",
  "rune-ansuz",
  "rune-raidho",
  "rune-kaunan",
  "rune-gebo",
  "rune-wunjo",
  "rune-hagalaz",
  "rune-naudiz",
  "rune-isaz",
  "rune-jera",
  "rune-iwaz",
  "rune-perth",
  "rune-algiz",
  "rune-sowilo",
  "rune-tiwaz",
  "rune-berkanan",
  "rune-ehwaz",
  "rune-mannaz",
  "rune-laguz",
  "rune-ingwaz",
  "rune-dagaz",
  "rune-othala",
] as const;

type RuneId = (typeof RUNE_IDS)[number];

export const RUNES: Record<RuneId, { char: string; strokes: Stroke[] }> = {
  "rune-fehu": { char: "ᚠ", strokes: [stem(), line(50, 22, 84, 8), line(50, 52, 84, 38)] },
  "rune-uruz": { char: "ᚢ", strokes: [line(26, 92, 26, 22), line(26, 22, 74, 34), line(74, 34, 74, 92)] },
  "rune-thurisaz": { char: "ᚦ", strokes: [stem(), line(50, 24, 78, 42), line(78, 42, 50, 60)] },
  "rune-ansuz": { char: "ᚨ", strokes: [stem(), line(50, 12, 82, 30), line(50, 42, 82, 60)] },
  "rune-raidho": {
    char: "ᚱ",
    strokes: [stem(), line(50, 10, 80, 28), line(80, 28, 50, 46), line(50, 46, 80, 90)],
  },
  "rune-kaunan": { char: "ᚲ", strokes: [line(30, 50, 68, 14), line(30, 50, 68, 86)] },
  "rune-gebo": { char: "ᚷ", strokes: [line(20, 14, 80, 86), line(80, 14, 20, 86)] },
  "rune-wunjo": { char: "ᚹ", strokes: [stem(), line(50, 12, 78, 32), line(78, 32, 50, 52)] },
  "rune-hagalaz": {
    char: "ᚺ",
    strokes: [line(28, 8, 28, 92), line(72, 8, 72, 92), line(28, 38, 72, 62)],
  },
  "rune-naudiz": { char: "ᚾ", strokes: [stem(), line(26, 68, 74, 32)] },
  "rune-isaz": { char: "ᛁ", strokes: [stem()] },
  "rune-jera": {
    char: "ᛃ",
    strokes: [line(32, 16, 56, 38), line(56, 38, 32, 60), line(68, 40, 44, 62), line(44, 62, 68, 84)],
  },
  "rune-iwaz": { char: "ᛇ", strokes: [stem(), line(50, 12, 74, 4), line(50, 88, 26, 96)] },
  "rune-perth": {
    char: "ᛈ",
    strokes: [
      line(30, 8, 30, 92),
      line(30, 22, 66, 34),
      line(66, 34, 30, 46),
      line(30, 54, 66, 66),
      line(66, 66, 30, 78),
    ],
  },
  "rune-algiz": { char: "ᛉ", strokes: [stem(), line(50, 34, 22, 10), line(50, 34, 78, 10)] },
  "rune-sowilo": {
    char: "ᛊ",
    strokes: [line(70, 12, 34, 34), line(34, 34, 68, 56), line(68, 56, 32, 88)],
  },
  "rune-tiwaz": { char: "ᛏ", strokes: [stem(), line(50, 8, 24, 34), line(50, 8, 76, 34)] },
  "rune-berkanan": {
    char: "ᛒ",
    strokes: [
      line(30, 8, 30, 92),
      line(30, 12, 70, 30),
      line(70, 30, 30, 48),
      line(30, 52, 70, 70),
      line(70, 70, 30, 88),
    ],
  },
  "rune-ehwaz": {
    char: "ᛖ",
    strokes: [line(28, 8, 28, 92), line(72, 8, 72, 92), line(28, 40, 50, 24), line(50, 24, 72, 40)],
  },
  "rune-mannaz": {
    char: "ᛗ",
    strokes: [line(28, 8, 28, 92), line(72, 8, 72, 92), line(28, 20, 72, 52), line(72, 20, 28, 52)],
  },
  "rune-laguz": { char: "ᛚ", strokes: [stem(), line(50, 20, 76, 44)] },
  "rune-ingwaz": {
    char: "ᛜ",
    strokes: [{ kind: "polyline", points: [[50, 22], [76, 50], [50, 78], [24, 50]], closed: true }],
  },
  "rune-dagaz": {
    char: "ᛞ",
    strokes: [line(26, 12, 26, 88), line(74, 12, 74, 88), line(26, 12, 74, 88), line(74, 12, 26, 88)],
  },
  "rune-othala": {
    char: "ᛟ",
    strokes: [
      { kind: "polyline", points: [[50, 10], [74, 34], [50, 58], [26, 34]], closed: true },
      line(50, 58, 30, 92),
      line(50, 58, 70, 92),
    ],
  },
};

/** Символ Unicode → идентификатор: надписи в контенте хранятся рунами, а рисуются штрихами. */
export const RUNE_BY_CHAR: Map<string, RuneId> = new Map(
  RUNE_IDS.map((id) => [RUNES[id].char, id]),
);

export function isRune(char: string): boolean {
  return RUNE_BY_CHAR.has(char);
}

/** Полный футарк в каноническом порядке — надпись сама по себе (камень из Кюльвера). */
