import type { DiagramFigure, DiagramView } from "@/contract/views";

import {
  CENTER,
  SIDE,
  absolute,
  arcCommand,
  inscriptionPlacements,
  placedStrokes,
  pointAt,
  squareSide,
  starPolygons,
  tickMarks,
} from "@/core/domain/catalog/diagram/geometry";
import { GLYPHS, SEALS } from "@/core/domain/catalog/diagram/glyphs";
import { RUNES, RUNE_BY_CHAR } from "@/core/domain/catalog/diagram/futhark";
import type { Stroke } from "@/core/domain/catalog/diagram/strokes";
import type { RitualDiagram } from "@/core/domain/catalog/spell";

type Mark = DiagramView["marks"][number];

const RUNE_SIZE = 0.06;
const RADIAL_GLYPH_SIZE = 0.09;
const CORNER_GLYPH_SIZE = 0.07;
const CORNER_RADIUS = 1.06;
const NUMBER_SIZE = 0.42;

export function figureOf(stroke: Stroke): DiagramFigure {
  const dashed = stroke.dashed === true ? { dashed: true } : {};
  switch (stroke.kind) {
    case "circle":
      return { kind: "circle", at: { x: stroke.cx, y: stroke.cy }, radius: stroke.r, ...dashed };
    case "line":
      return {
        kind: "line",
        from: { x: stroke.x1, y: stroke.y1 },
        to: { x: stroke.x2, y: stroke.y2 },
        ...dashed,
      };
    case "polyline":
      return {
        kind: "polyline",
        points: stroke.points.map(([x, y]) => ({ x, y })),
        ...(stroke.closed === true ? { closed: true } : {}),
        ...dashed,
      };
    default: {
      const arc = arcCommand(stroke.cx, stroke.cy, stroke.r, stroke.fromDegrees, stroke.toDegrees);
      return {
        kind: "arc",
        from: arc.from,
        to: arc.to,
        radius: arc.r,
        largeArc: arc.largeArc,
        sweep: arc.sweep,
        ...dashed,
      };
    }
  }
}

function glyphMark(
  layer: string,
  strokes: readonly Stroke[],
  at: { x: number; y: number },
  size: number,
  rotation?: number,
): Mark {
  const placement = { at, size, ...(rotation === undefined ? {} : { rotation }) };
  return { layer, figures: placedStrokes(strokes, placement).map(figureOf) };
}

function inscriptionMarks(inscription: NonNullable<RitualDiagram["inscription"]>): Mark[] {
  const runes = [...inscription.runes].map((char) => RUNE_BY_CHAR.get(char));

  return inscriptionPlacements(runes.length, absolute(inscription.radius)).flatMap(
    (place, index) => {
      const id = runes[index];
      if (id === undefined) return [];
      return [
        glyphMark(
          "inscription-rune",
          RUNES[id].strokes,
          place.at,
          absolute(RUNE_SIZE),
          place.rotation,
        ),
      ];
    },
  );
}

function magicSquareMark(square: NonNullable<RitualDiagram["magicSquare"]>): Mark {
  const side = squareSide(absolute(square.radius));
  const cell = side / 3;
  const left = CENTER - side / 2;
  const top = CENTER - side / 2;
  const grid = [0, 1, 2, 3];

  return {
    layer: "magic-square",
    figures: [
      ...grid.map((index): DiagramFigure => ({
        kind: "line",
        from: { x: left, y: top + cell * index },
        to: { x: left + side, y: top + cell * index },
      })),
      ...grid.map((index): DiagramFigure => ({
        kind: "line",
        from: { x: left + cell * index, y: top },
        to: { x: left + cell * index, y: top + side },
      })),
      ...square.rows.flatMap((row, rowIndex) =>
        row.map((value, columnIndex): DiagramFigure => ({
          kind: "number",
          at: {
            x: left + cell * (columnIndex + 0.5),
            y: top + cell * (rowIndex + 0.5),
          },
          size: cell * NUMBER_SIZE,
          value,
        })),
      ),
    ],
  };
}

export function toDiagramView(diagram: RitualDiagram): DiagramView {
  const { tickRing, inscription, star, radialGlyphs, crossAxes, magicSquare, cornerMarks } = diagram;

  const rings: Mark[] = diagram.rings.map((fraction) => ({
    layer: "ring",
    figures: [{ kind: "circle", at: { x: CENTER, y: CENTER }, radius: absolute(fraction) }],
  }));

  const ticks: Mark[] =
    tickRing === undefined
      ? []
      : tickMarks(tickRing.count, absolute(tickRing.radius), absolute(0.03)).map(
          ([outer, inner]) => ({ layer: "tick", figures: [{ kind: "line", from: outer, to: inner }] }),
        );

  const stars: Mark[] =
    star === undefined
      ? []
      : starPolygons(star.points, star.skip, absolute(star.radius)).map((cycle) => ({
          layer: "star-cycle",
          figures: [{ kind: "polyline", points: cycle, closed: true }],
        }));

  const glyphs: Mark[] =
    radialGlyphs === undefined
      ? []
      : radialGlyphs.glyphs.map((id, index) =>
          glyphMark(
            "radial-glyph",
            GLYPHS[id],
            pointAt(absolute(radialGlyphs.radius), index, radialGlyphs.glyphs.length),
            absolute(RADIAL_GLYPH_SIZE),
          ),
        );

  const axes: Mark[] =
    crossAxes === undefined
      ? []
      : Array.from({ length: crossAxes.count }, (_unused, index) => ({
          layer: "cross-axis",
          figures: [
            {
              kind: "line" as const,
              from: { x: CENTER, y: CENTER },
              to: pointAt(absolute(crossAxes.radius), index, crossAxes.count),
            },
          ],
        }));

  const corners: Mark[] =
    cornerMarks === undefined
      ? []
      : cornerMarks.map((id, index) =>
          glyphMark(
            "corner-mark",
            GLYPHS[id],
            pointAt(absolute(CORNER_RADIUS), index * 2 + 1, 8),
            absolute(CORNER_GLYPH_SIZE),
          ),
        );

  return {
    side: SIDE,
    marks: [
      ...rings,
      ...ticks,
      ...(inscription === undefined ? [] : inscriptionMarks(inscription)),
      ...stars,
      ...glyphs,
      ...axes,
      ...(magicSquare === undefined ? [] : [magicSquareMark(magicSquare)]),
      glyphMark(
        "central-seal",
        SEALS[diagram.centralSeal.kind],
        { x: CENTER, y: CENTER },
        absolute(diagram.centralSeal.radius) * 2,
      ),
      ...corners,
    ],
    captionRu: diagram.captionRu,
  };
}
