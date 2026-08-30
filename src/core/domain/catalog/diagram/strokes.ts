export type Stroke =
  | { kind: "circle"; cx: number; cy: number; r: number; dashed?: true }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; dashed?: true }
  | { kind: "polyline"; points: readonly (readonly [number, number])[]; closed?: true; dashed?: true }
  | {
      kind: "arc";
      cx: number;
      cy: number;
      r: number;
      fromDegrees: number;
      toDegrees: number;
      dashed?: true;
    };

export const BOX = 100;

export const BOX_CENTER = BOX / 2;

const STEM_INSET = 8;

export function line(x1: number, y1: number, x2: number, y2: number): Stroke {
  return { kind: "line", x1, y1, x2, y2 };
}

export function stem(): Stroke {
  return line(BOX_CENTER, STEM_INSET, BOX_CENTER, BOX - STEM_INSET);
}
