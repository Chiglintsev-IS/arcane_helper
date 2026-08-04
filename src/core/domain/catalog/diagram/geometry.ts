/**
 * Геометрия схемы ритуала.
 *
 * Единицы: viewBox 1000×1000, центр (500, 500), внешний радиус 460 — остаток отдан знакам вне круга.
 * Отсчёт углов начинается сверху и идёт по часовой стрелке: так же, как рука ведёт круг по бумаге,
 * и поэтому порядок вершин в данных совпадает с порядком рисования.
 */

export const CENTER = 500;
const OUTER_RADIUS = 460;
export const VIEW_BOX = "0 0 1000 1000";

type Point = { x: number; y: number };

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
export function arcPath(
  cx: number,
  cy: number,
  r: number,
  fromDegrees: number,
  toDegrees: number,
): string {
  const at = (degrees: number): Point => {
    const angle = ((degrees / 360) * 2 - 0.5) * Math.PI;
    return { x: round(cx + r * Math.cos(angle)), y: round(cy + r * Math.sin(angle)) };
  };
  const start = at(fromDegrees);
  const end = at(toDegrees);
  const sweep = toDegrees > fromDegrees ? 1 : 0;
  const largeArc = Math.abs(toDegrees - fromDegrees) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}
