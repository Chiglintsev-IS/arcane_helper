// @vitest-environment jsdom

/**
 * Отрисовка схемы. Проверяется состав слоёв, а не красота: пропорции доводятся глазом.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { spell } from "@/ui/app/testing/stores";
import { RitualDiagram } from "./RitualDiagram";

function diagramOf(id: string) {
  const found = spell(id).ritualDiagram;
  if (found === undefined) throw new Error(`у ${id} нет схемы`);
  return found;
}

function layers(container: HTMLElement, layer: string): Element[] {
  return [...container.querySelectorAll(`[data-layer="${layer}"]`)];
}

describe("слои схемы", () => {
  it("рисует все кольца «Опознания»", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("identify")} />);
    expect(layers(container, "ring")).toHaveLength(3);
  });

  it("рисует 72 деления", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("identify")} />);
    expect(layers(container, "tick")).toHaveLength(72);
  });

  it("рисует надпись по руне на знак", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("identify")} />);
    expect(layers(container, "inscription-rune")).toHaveLength(24);
  });

  it("гептаграмма — один обход, гексаграмма — два", () => {
    const seven = render(<RitualDiagram diagram={diagramOf("identify")} />);
    expect(layers(seven.container, "star-cycle")).toHaveLength(1);

    const six = render(<RitualDiagram diagram={diagramOf("find-familiar")} />);
    expect(layers(six.container, "star-cycle")).toHaveLength(2);
  });

  it("рисует семь знаков металлов на вершинах", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("identify")} />);
    expect(layers(container, "radial-glyph")).toHaveLength(7);
  });

  it("рисует числовой квадрат с девятью числами", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("identify")} />);
    expect(layers(container, "magic-square")).toHaveLength(1);
    expect([...container.querySelectorAll("text")].map((node) => node.textContent)).toEqual([
      "4", "9", "2", "3", "5", "7", "8", "1", "6",
    ]);
  });

  it("рисует печать центра", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("unseen-servant")} />);
    expect(layers(container, "central-seal")).toHaveLength(1);
  });

  it("рисует четыре угловых знака у круга вызова", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("find-familiar")} />);
    expect(layers(container, "corner-mark")).toHaveLength(4);
  });

  it("не рисует слоёв, которых в данных нет", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("find-familiar")} />);
    expect(layers(container, "tick")).toHaveLength(0);
    expect(layers(container, "magic-square")).toHaveLength(0);
  });

  it("цвет берётся у текста, заливки нет: рисунок повторим пером", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("identify")} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.getAttribute("fill")).toBe("none");
  });
});
