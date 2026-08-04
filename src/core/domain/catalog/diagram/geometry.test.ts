import { describe, expect, it } from "vitest";

import {
  CENTER,
  absolute,
  arcPath,
  inscriptionPlacements,
  pointAt,
  squareSide,
  starPolygons,
  tickMarks,
} from "@/core/domain/catalog/diagram/geometry";

describe("единицы и точки", () => {
  it("доля внешнего радиуса переводится в единицы схемы", () => {
    // Само число радиуса — дело геометрии; наружу видна только пропорция.
    expect(absolute(0.5)).toBe(absolute(1) / 2);
    expect(absolute(0)).toBe(0);
  });

  it("отсчёт идёт от верха по часовой стрелке", () => {
    // Четыре точки: верх, право, низ, лево. Так же, как рука ведёт круг.
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

  it("дуга описывается путём с командой A", () => {
    const path = arcPath(50, 50, 30, 0, 180);
    expect(path.startsWith("M ")).toBe(true);
    expect(path).toContain("A 30 30");
  });

  it("дуга больше полуокружности помечается флагом large-arc", () => {
    expect(arcPath(50, 50, 30, 0, 270)).toContain(" 1 1 ");
    expect(arcPath(50, 50, 30, 0, 90)).toContain(" 0 1 ");
  });

  it("дуга назад ведётся против часовой: рука идёт в ту сторону, куда заказано", () => {
    expect(arcPath(50, 50, 30, 90, 0)).toContain(" 0 0 ");
  });
});
