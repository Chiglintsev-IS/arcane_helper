/**
 * Проекция схемы ритуала.
 *
 * Проверяется состав слоёв и то, что наружу уходит рисунок, а не описание: пропорции доводятся
 * глазом, и число в ожидании про красоту ничего не говорит.
 */

import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { RitualDiagram } from "@/core/domain/catalog/spell";

import { toDiagramView } from "./diagramView";

function diagramOf(id: string): RitualDiagram {
  const found = loadThorneSpells().find((spell) => spell.id === id)?.ritualDiagram;
  if (found === undefined) throw new Error(`у ${id} нет схемы`);
  return found;
}

function layers(diagram: RitualDiagram, layer: string) {
  return toDiagramView(diagram).marks.filter((mark) => mark.layer === layer);
}

describe("слои", () => {
  it("кольца, деления и надпись — по знаку на слой", () => {
    const identify = diagramOf("identify");

    expect(layers(identify, "ring")).toHaveLength(3);
    expect(layers(identify, "tick")).toHaveLength(72);
    expect(layers(identify, "inscription-rune")).toHaveLength(24);
  });

  it("гептаграмма — один обход, гексаграмма — два", () => {
    expect(layers(diagramOf("identify"), "star-cycle")).toHaveLength(1);
    expect(layers(diagramOf("find-familiar"), "star-cycle")).toHaveLength(2);
  });

  it("знаки на вершинах, оси и угловые знаки", () => {
    expect(layers(diagramOf("identify"), "radial-glyph")).toHaveLength(7);
    expect(layers(diagramOf("find-familiar"), "cross-axis")).toHaveLength(4);
    expect(layers(diagramOf("find-familiar"), "corner-mark")).toHaveLength(4);
  });

  it("печать центра есть у каждой схемы, а квадрат — только у своей", () => {
    expect(layers(diagramOf("find-familiar"), "central-seal")).toHaveLength(1);
    expect(layers(diagramOf("identify"), "magic-square")).toHaveLength(1);
    expect(layers(diagramOf("find-familiar"), "magic-square")).toHaveLength(0);
    expect(layers(diagramOf("find-familiar"), "tick")).toHaveLength(0);
  });

  it("порядок слоёв — порядок рисования: обвод первым, печать после квадрата", () => {
    const order = toDiagramView(diagramOf("identify")).marks.map((mark) => mark.layer);

    expect(order[0]).toBe("ring");
    expect(order.indexOf("magic-square")).toBeLessThan(order.indexOf("central-seal"));
    expect(order.indexOf("tick")).toBeLessThan(order.indexOf("inscription-rune"));
  });
});

describe("рисунок вместо описания", () => {
  it("числовой квадрат приезжает девятью числами по клеткам", () => {
    const [square] = layers(diagramOf("identify"), "magic-square");
    const numbers = (square?.figures ?? []).flatMap((figure) =>
      figure.kind === "number" ? [figure.value] : [],
    );

    expect(numbers).toEqual([4, 9, 2, 3, 5, 7, 8, 1, 6]);
  });

  it("знак приезжает штрихами в единицах листа, а не своим именем", () => {
    const view = toDiagramView(diagramOf("identify"));
    const [glyph] = view.marks.filter((mark) => mark.layer === "radial-glyph");
    const points = (glyph?.figures ?? []).flatMap((figure) =>
      figure.kind === "circle" ? [figure.at] : [],
    );

    expect(glyph?.figures.length).toBeGreaterThan(0);
    for (const point of points) {
      expect(point.x).toBeGreaterThan(0);
      expect(point.x).toBeLessThan(view.side);
    }
  });

  it("пунктирная печать везёт признак штриха, а замкнутая ломаная — замкнутость", () => {
    const [seal] = layers(diagramOf("unseen-servant"), "central-seal");

    expect(seal?.figures).toEqual([
      expect.objectContaining({ kind: "polyline", closed: true, dashed: true }),
    ]);
  });

  it("дуга приезжает концами и флагами: синуса на рисующей стороне нет", () => {
    // «Глаз» сложен из двух дуг: у каждой названы концы, радиус и какая из четырёх это дуга.
    const [seal] = layers(diagramOf("identify"), "central-seal");
    const arcs = (seal?.figures ?? []).filter((figure) => figure.kind === "arc");

    const [first] = arcs;
    expect(arcs).toHaveLength(2);
    expect(first).toMatchObject({
      from: { x: 551.31, y: 470.38 },
      to: { x: 551.31, y: 529.63 },
      radius: 59.25,
      largeArc: false,
      sweep: true,
    });
  });

  it("подпись едет с рисунком: без неё лист не объяснить", () => {
    expect(toDiagramView(diagramOf("identify")).captionRu).not.toBe("");
  });

  it("необязательного слоя нет — нет и его знаков: обязательны кольца, печать и подпись", () => {
    // Схема без надписи законна: слои набираются по вкусу ритуала.
    const { inscription: _none, ...silent } = diagramOf("find-familiar");

    expect(layers(silent, "inscription-rune")).toHaveLength(0);
    expect(layers(silent, "ring").length).toBeGreaterThan(0);
    expect(layers(silent, "central-seal")).toHaveLength(1);
  });

  it("знак не из футарка не рисуется: выдумывать его нечем", () => {
    const identify = diagramOf("identify");
    if (identify.inscription === undefined) throw new Error("у «Опознания» нет надписи");
    const strange: RitualDiagram = {
      ...identify,
      inscription: { ...identify.inscription, runes: "ᚠ?ᚢ" },
    };

    expect(layers(strange, "inscription-rune")).toHaveLength(2);
  });
});
