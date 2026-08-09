/**
 * Геометрия схемы ритуала.
 *
 * Единицы: лист 1000×1000, центр (500, 500), внешний радиус 460 — остаток отдан знакам вне круга.
 * Отсчёт углов начинается сверху и идёт по часовой стрелке: так же, как рука ведёт круг по бумаге,
 * и поэтому порядок вершин в данных совпадает с порядком рисования.
 */

import { BOX, BOX_CENTER, type Stroke } from "@/core/domain/catalog/diagram/strokes";

/** Сторона листа: в её единицах и приходит начерченное. */
export const SIDE = 1000;
export const CENTER = SIDE / 2;
const OUTER_RADIUS = 460;

type Point = { x: number; y: number };

/** Куда ставится знак: точка листа, сторона его бокса и поворот по часовой стрелке в градусах. */
type Placement = { at: Point; size: number; rotation?: number };

/** Дуга командой рисования: откуда, куда, каким радиусом и какая из четырёх подходящих дуг. */
type Arc = { from: Point; to: Point; r: number; largeArc: boolean; sweep: boolean };

/** Два знака после запятой: в разметке лишняя точность только мешает читать. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Доля внешнего радиуса в единицы схемы. */
export function absolute(fraction: number): number {
  return round(fraction * OUTER_RADIUS);
}

export function pointAt(radius: number, index: number, count: number): Point {
  const angle = ((index / count) * 2 - 0.5) * Math.PI;
  return { x: round(CENTER + radius * Math.cos(angle)), y: round(CENTER + radius * Math.sin(angle)) };
}

/**
 * Обходы звёздчатого многоугольника {points}/{skip}.
 *
 * При НОД(points, skip) > 1 фигура составная: гексаграмма 6/2 — это два треугольника, а не один
 * обход. Возвращается список обходов, потому что рисуются они раздельно — и рукой тоже.
 */
export function starPolygons(points: number, skip: number, radius: number): Point[][] {
  const cycles: Point[][] = [];
  const visited = new Set<number>();

  for (let start = 0; start < points; start += 1) {
    if (visited.has(start)) continue;
    const cycle: Point[] = [];
    let index = start;
    do {
      visited.add(index);
      cycle.push(pointAt(radius, index, points));
      index = (index + skip) % points;
    } while (index !== start);
    cycles.push(cycle);
  }

  return cycles;
}

/** Деления по обводу: пара точек на каждое, от внешнего радиуса внутрь. */
export function tickMarks(count: number, radius: number, length: number): [Point, Point][] {
  return Array.from({ length: count }, (_unused, index) => [
    pointAt(radius, index, count),
    pointAt(radius - length, index, count),
  ]);
}

/** Место и поворот каждого знака надписи: верх знака смотрит из центра. */
export function inscriptionPlacements(
  count: number,
  radius: number,
): { at: Point; rotation: number }[] {
  return Array.from({ length: count }, (_unused, index) => ({
    at: pointAt(radius, index, count),
    rotation: round((index / count) * 360),
  }));
}

/** Сторона квадрата, вписанного в окружность. */
export function squareSide(radius: number): number {
  return round(radius * Math.SQRT2);
}

/** Дуга от угла к углу в градусах, отсчёт как у pointAt. */
export function arcCommand(
  cx: number,
  cy: number,
  r: number,
  fromDegrees: number,
  toDegrees: number,
): Arc {
  const at = (degrees: number): Point => {
    const angle = ((degrees / 360) * 2 - 0.5) * Math.PI;
    return { x: round(cx + r * Math.cos(angle)), y: round(cy + r * Math.sin(angle)) };
  };
  return {
    from: at(fromDegrees),
    to: at(toDegrees),
    r,
    largeArc: Math.abs(toDegrees - fromDegrees) > 180,
    // Рука идёт в ту сторону, куда заказано: назад дуга ведётся против часовой.
    sweep: toDegrees > fromDegrees,
  };
}

/**
 * Штрихи знака в единицах листа: бокс 100×100 переносится, поворачивается и масштабируется.
 *
 * Знак не знает, куда его поставят, и рисуется в своём боксе; сюда он приходит вместе с местом.
 * Толщина линии от размера знака не зависит — её выбирает перо, а не масштаб.
 */
export function placedStrokes(
  strokes: readonly Stroke[],
  { at, size, rotation = 0 }: Placement,
): Stroke[] {
  const scale = size / BOX;
  const angle = (rotation / 180) * Math.PI;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  const move = (x: number, y: number): Point => {
    const dx = (x - BOX_CENTER) * scale;
    const dy = (y - BOX_CENTER) * scale;
    return {
      x: round(at.x + dx * cosine - dy * sine),
      y: round(at.y + dx * sine + dy * cosine),
    };
  };

  return strokes.map((stroke) => {
    const dashed = stroke.dashed === true ? { dashed: true as const } : {};
    switch (stroke.kind) {
      case "circle": {
        const center = move(stroke.cx, stroke.cy);
        return { kind: "circle", cx: center.x, cy: center.y, r: round(stroke.r * scale), ...dashed };
      }
      case "line": {
        const from = move(stroke.x1, stroke.y1);
        const to = move(stroke.x2, stroke.y2);
        return { kind: "line", x1: from.x, y1: from.y, x2: to.x, y2: to.y, ...dashed };
      }
      case "polyline": {
        const points = stroke.points.map(([x, y]) => {
          const point = move(x, y);
          return [point.x, point.y] as const;
        });
        return {
          kind: "polyline",
          points,
          ...(stroke.closed === true ? { closed: true as const } : {}),
          ...dashed,
        };
      }
      default: {
        const center = move(stroke.cx, stroke.cy);
        return {
          kind: "arc",
          cx: center.x,
          cy: center.y,
          r: round(stroke.r * scale),
          // Поворот знака — тот же поворот отсчёта: у дуги он прибавляется к обоим углам.
          fromDegrees: stroke.fromDegrees + rotation,
          toDegrees: stroke.toDegrees + rotation,
          ...dashed,
        };
      }
    }
  });
}
