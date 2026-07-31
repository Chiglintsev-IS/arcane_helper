/**
 * Штрих схемы ритуала: минимальная единица формы (FR-191).
 *
 * Всё задаётся в боксе 100×100 с центром (50, 50) — знак не знает, куда его поставят и как
 * масштабируют. Заливок нет: рисунок должен быть повторим пером, а перо не заливает.
 */

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

/** Отрезок: самая частая форма, руны состоят только из них. */
export function line(x1: number, y1: number, x2: number, y2: number): Stroke {
  return { kind: "line", x1, y1, x2, y2 };
}

/** Вертикальный стебель руны: общая часть большинства знаков футарка. */
export function stem(): Stroke {
  return line(50, 8, 50, 92);
}
