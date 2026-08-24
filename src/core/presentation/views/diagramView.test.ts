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

/**
 * Слой, которого у книжных ритуалов нет.
 *
 * Ритуалов в книге два, и вида печати у каждого один: подменённая печать и приставленный квадрат
 * проверяют рисование, а не состав книги — состав держит прогон контента.
 */
function withSeal(diagram: RitualDiagram, kind: "eye" | "empty-hand"): RitualDiagram {
  return { ...diagram, centralSeal: { ...diagram.centralSeal, kind } };
}

function withMagicSquare(diagram: RitualDiagram): RitualDiagram {
  return {
    ...diagram,
    magicSquare: { rows: [[4, 9, 2], [3, 5, 7], [8, 1, 6]], radius: 0.7 },
  };
}

describe("слои", () => {
  it("кольца, деления и надпись — по знаку на слой", () => {
    const detectMagic = diagramOf("detect-magic");

    expect(layers(detectMagic, "ring")).toHaveLength(4);
    expect(layers(detectMagic, "tick")).toHaveLength(36);
    expect(layers(detectMagic, "inscription-rune")).toHaveLength(6);
  });

  it("восьмиконечная звезда — один обход, гексаграмма — два", () => {
    expect(layers(diagramOf("detect-magic"), "star-cycle")).toHaveLength(1);
    expect(layers(diagramOf("find-familiar"), "star-cycle")).toHaveLength(2);
  });

  it("знаки на вершинах, оси и угловые знаки", () => {
    expect(layers(diagramOf("detect-magic"), "radial-glyph")).toHaveLength(8);
    expect(layers(diagramOf("find-familiar"), "cross-axis")).toHaveLength(4);
    expect(layers(diagramOf("find-familiar"), "corner-mark")).toHaveLength(4);
  });

  it("печать центра есть у каждой схемы, а квадрат — только у своей", () => {
    expect(layers(diagramOf("find-familiar"), "central-seal")).toHaveLength(1);
    expect(layers(withMagicSquare(diagramOf("detect-magic")), "magic-square")).toHaveLength(1);
    expect(layers(diagramOf("find-familiar"), "magic-square")).toHaveLength(0);
    expect(layers(diagramOf("find-familiar"), "tick")).toHaveLength(0);
  });

  it("порядок слоёв — порядок рисования: обвод первым, печать после квадрата", () => {
    const order = toDiagramView(withMagicSquare(diagramOf("detect-magic"))).marks.map(
      (mark) => mark.layer,
    );

    expect(order[0]).toBe("ring");
    expect(order.indexOf("magic-square")).toBeLessThan(order.indexOf("central-seal"));
    expect(order.indexOf("tick")).toBeLessThan(order.indexOf("inscription-rune"));
  });
});

describe("рисунок вместо описания", () => {
  it("числовой квадрат приезжает девятью числами по клеткам", () => {
    const [square] = layers(withMagicSquare(diagramOf("detect-magic")), "magic-square");
    const numbers = (square?.figures ?? []).flatMap((figure) =>
      figure.kind === "number" ? [figure.value] : [],
    );

    expect(numbers).toEqual([4, 9, 2, 3, 5, 7, 8, 1, 6]);
  });

  it("знак приезжает штрихами в единицах листа, а не своим именем", () => {
    const view = toDiagramView(diagramOf("detect-magic"));
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
    const [seal] = layers(withSeal(diagramOf("find-familiar"), "empty-hand"), "central-seal");

    expect(seal?.figures).toEqual([
      expect.objectContaining({ kind: "polyline", closed: true, dashed: true }),
    ]);
  });

  it("дуга приезжает концами и флагами: синуса на рисующей стороне нет", () => {
    // «Глаз» сложен из двух дуг: у каждой названы концы, радиус и какая из четырёх это дуга.
    const [seal] = layers(withSeal(diagramOf("detect-magic"), "eye"), "central-seal");
    const arcs = (seal?.figures ?? []).filter((figure) => figure.kind === "arc");

    const [first] = arcs;
    expect(arcs).toHaveLength(2);
    expect(first).toMatchObject({
      from: { x: 624.61, y: 428.06 },
      to: { x: 624.61, y: 571.94 },
      radius: 143.89,
      largeArc: false,
      sweep: true,
    });
  });

  it("подпись едет с рисунком: без неё лист не объяснить", () => {
    expect(toDiagramView(diagramOf("detect-magic")).captionRu).not.toBe("");
  });

  it("необязательного слоя нет — нет и его знаков: обязательны кольца, печать и подпись", () => {
    // Схема без надписи, звезды и осей законна: слои набираются по вкусу ритуала, и оба книжных
    // ритуала сегодня взяли все три — значит пустой случай проверяется схемой без них.
    const {
      inscription: _none,
      star: _noStar,
      crossAxes: _noAxes,
      ...bare
    } = diagramOf("find-familiar");

    expect(layers(bare, "inscription-rune")).toHaveLength(0);
    expect(layers(bare, "star-cycle")).toHaveLength(0);
    expect(layers(bare, "cross-axis")).toHaveLength(0);
    expect(layers(bare, "ring").length).toBeGreaterThan(0);
    expect(layers(bare, "central-seal")).toHaveLength(1);
  });

  it("знак не из футарка не рисуется: выдумывать его нечем", () => {
    const detectMagic = diagramOf("detect-magic");
    if (detectMagic.inscription === undefined) {
      throw new Error("у «Обнаружения магии» нет надписи");
    }
    const strange: RitualDiagram = {
      ...detectMagic,
      inscription: { ...detectMagic.inscription, runes: "ᚠ?ᚢ" },
    };

    expect(layers(strange, "inscription-rune")).toHaveLength(2);
  });
});
