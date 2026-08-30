// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { testSpellRow } from "@/ui/app/testing/stores";
import { RitualDiagram } from "./RitualDiagram";

function diagramOf(id: string) {
  const found = testSpellRow(id).card.ritualDiagram;
  if (found === undefined) throw new Error(`у ${id} нет схемы`);
  return found;
}

function layers(container: HTMLElement, layer: string): Element[] {
  return [...container.querySelectorAll(`[data-layer="${layer}"]`)];
}

describe("слои схемы", () => {
  it("рисует все кольца «Обнаружения магии»", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("detect-magic")} />);
    expect(layers(container, "ring")).toHaveLength(4);
  });

  it("рисует 36 делений", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("detect-magic")} />);
    expect(layers(container, "tick")).toHaveLength(36);
  });

  it("рисует надпись по руне на знак", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("detect-magic")} />);
    expect(layers(container, "inscription-rune")).toHaveLength(6);
  });

  it("звезда рисуется обходом, а её отсутствие не рисуется вовсе", () => {
    const eight = render(<RitualDiagram diagram={diagramOf("detect-magic")} />);
    expect(layers(eight.container, "star-cycle")).toHaveLength(1);

    const none = render(<RitualDiagram diagram={diagramOf("alarm")} />);
    expect(layers(none.container, "star-cycle")).toHaveLength(0);
  });

  it("рисует восемь рунных знаков на вершинах", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("detect-magic")} />);
    expect(layers(container, "radial-glyph")).toHaveLength(8);
  });

  it("рисует числовой квадрат с девятью числами", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("alarm")} />);
    expect(layers(container, "magic-square")).toHaveLength(1);
    expect([...container.querySelectorAll("text")].map((node) => node.textContent)).toEqual([
      "4", "9", "2", "3", "5", "7", "8", "1", "6",
    ]);
  });

  it("рисует печать центра", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("alarm")} />);
    expect(layers(container, "central-seal")).toHaveLength(1);
  });

  it("рисует четыре угловых знака по сторонам листа", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("alarm")} />);
    expect(layers(container, "corner-mark")).toHaveLength(4);
  });

  it("не рисует слоёв, которых в данных нет", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("detect-magic")} />);
    expect(layers(container, "magic-square")).toHaveLength(0);
    expect(layers(container, "corner-mark")).toHaveLength(0);
  });

  it("цвет берётся у текста, заливки нет: рисунок повторим пером", () => {
    const { container } = render(<RitualDiagram diagram={diagramOf("detect-magic")} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
    expect(svg?.getAttribute("fill")).toBe("none");
  });
});
