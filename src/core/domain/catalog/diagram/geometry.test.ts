import { describe, expect, it } from "vitest";

import {
  CENTER,
  absolute,
  arcCommand,
  inscriptionPlacements,
  placedStrokes,
  pointAt,
  squareSide,
  starPolygons,
  tickMarks,
} from "@/core/domain/catalog/diagram/geometry";

describe("единицы и точки", () => {
  it("доля внешнего радиуса переводится в единицы схемы", () => {
    expect(absolute(0.5)).toBe(absolute(1) / 2);
    expect(absolute(0)).toBe(0);
  });

  it("отсчёт идёт от верха по часовой стрелке", () => {
    expect(pointAt(100, 0, 4)).toEqual({ x: CENTER, y: CENTER - 100 });
    expect(pointAt(100, 1, 4)).toEqual({ x: CENTER + 100, y: CENTER });
    expect(pointAt(100, 2, 4)).toEqual({ x: CENTER, y: CENTER + 100 });
    expect(pointAt(100, 3, 4)).toEqual({ x: CENTER - 100, y: CENTER });
  });

  it("координаты округляются до двух знаков: в разметке не нужны шестнадцать", () => {
    const { x } = pointAt(100, 1, 3);
    expect(x).toBe(586.6);
  });
});

describe("звёздчатый многоугольник", () => {
  it("гептаграмма 7/3 — один обход через все семь вершин", () => {
    const cycles = starPolygons(7, 3, 100);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]).toHaveLength(7);
  });

  it("гексаграмма 6/2 — два треугольника, а не один обход", () => {
    const cycles = starPolygons(6, 2, 100);
    expect(cycles).toHaveLength(2);
    expect(cycles.map((cycle) => cycle.length)).toEqual([3, 3]);
  });

  it("октаграмма 8/3 — один обход через все восемь вершин", () => {
    expect(starPolygons(8, 3, 100)).toHaveLength(1);
  });

  it("вершины лежат на окружности заданного радиуса", () => {
    for (const point of starPolygons(7, 3, 100)[0] ?? []) {
      const distance = Math.hypot(point.x - CENTER, point.y - CENTER);
      expect(distance).toBeCloseTo(100, 1);
    }
  });
});

describe("деления и надпись", () => {
  it("делений столько, сколько заказано, и каждое — пара точек", () => {
    const ticks = tickMarks(36, 400, 20);
    expect(ticks).toHaveLength(36);
    expect(ticks[0]?.[0]).toEqual({ x: CENTER, y: CENTER - 400 });
    expect(ticks[0]?.[1]).toEqual({ x: CENTER, y: CENTER - 380 });
  });

  it("знаки надписи расставлены по кругу и повёрнуты наружу", () => {
    const places = inscriptionPlacements(4, 400);
    expect(places).toHaveLength(4);
    expect(places[0]).toEqual({ at: { x: CENTER, y: CENTER - 400 }, rotation: 0 });
    expect(places[1]?.rotation).toBe(90);
    expect(places[3]?.rotation).toBe(270);
  });
});

describe("квадрат и дуга", () => {
  it("сторона вписанного квадрата — радиус на корень из двух", () => {
    expect(squareSide(100)).toBeCloseTo(141.42, 1);
  });

  it("дуга описывается концами и радиусом", () => {
    expect(arcCommand(50, 50, 30, 0, 180)).toMatchObject({
      from: { x: 50, y: 20 },
      to: { x: 50, y: 80 },
      r: 30,
    });
  });

  it("дуга больше полуокружности помечается флагом", () => {
    expect(arcCommand(50, 50, 30, 0, 270).largeArc).toBe(true);
    expect(arcCommand(50, 50, 30, 0, 90).largeArc).toBe(false);
  });

  it("дуга назад ведётся против часовой: рука идёт в ту сторону, куда заказано", () => {
    expect(arcCommand(50, 50, 30, 0, 90).sweep).toBe(true);
    expect(arcCommand(50, 50, 30, 90, 0).sweep).toBe(false);
  });
});

describe("знак на своём месте", () => {
  it("бокс знака встаёт центром в точку и сжимается до заказанного размера", () => {
    const [placed] = placedStrokes([{ kind: "line", x1: 0, y1: 50, x2: 100, y2: 50 }], {
      at: { x: 200, y: 300 },
      size: 50,
    });

    expect(placed).toEqual({ kind: "line", x1: 175, y1: 300, x2: 225, y2: 300 });
  });

  it("незамкнутая ломаная замкнутости не приобретает: признак приходит от штриха", () => {
    const [open] = placedStrokes([{ kind: "polyline", points: [[0, 0], [100, 100]] }], {
      at: { x: 100, y: 100 },
      size: 100,
    });
    const [closed] = placedStrokes(
      [{ kind: "polyline", points: [[0, 0], [100, 100]], closed: true }],
      { at: { x: 100, y: 100 }, size: 100 },
    );

    expect(open).not.toHaveProperty("closed");
    expect(closed).toMatchObject({ closed: true });
  });

  it("поворот идёт по часовой стрелке вокруг той же точки", () => {
    const [placed] = placedStrokes([{ kind: "line", x1: 50, y1: 0, x2: 50, y2: 100 }], {
      at: { x: 100, y: 100 },
      size: 100,
      rotation: 90,
    });

    expect(placed).toEqual({ kind: "line", x1: 150, y1: 100, x2: 50, y2: 100 });
  });

  it("окружность и дуга везут радиус в тех же единицах, что и точки", () => {
    const strokes = placedStrokes(
      [
        { kind: "circle", cx: 50, cy: 50, r: 40 },
        { kind: "arc", cx: 50, cy: 50, r: 40, fromDegrees: 0, toDegrees: 90 },
      ],
      { at: { x: 500, y: 500 }, size: 50, rotation: 10 },
    );

    expect(strokes[0]).toEqual({ kind: "circle", cx: 500, cy: 500, r: 20 });
    expect(strokes[1]).toMatchObject({ r: 20, fromDegrees: 10, toDegrees: 100 });
  });

  it("ломаная и пунктир переезжают как есть: замкнутость и штрих сохраняются", () => {
    const [placed] = placedStrokes(
      [{ kind: "polyline", points: [[0, 0], [100, 0], [50, 100]], closed: true, dashed: true }],
      { at: { x: 100, y: 100 }, size: 100 },
    );

    expect(placed).toEqual({
      kind: "polyline",
      points: [[50, 50], [150, 50], [100, 150]],
      closed: true,
      dashed: true,
    });
  });
});
