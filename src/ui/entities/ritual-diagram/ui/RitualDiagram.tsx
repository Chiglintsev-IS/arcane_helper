/**
 * Отрисовка схемы ритуала.
 *
 * Слои рисуются в том порядке, в котором их выводят рукой: обвод, деления, надпись, звезда, знаки,
 * оси, квадрат, печать, угловые знаки. Заливок нет и цвет наследуется от текста — схема живёт в обеих
 * темах и повторяется пером.
 *
 * Атрибуты data-layer существуют для тестов: состав слоёв проверяется поведением, потому что
 * компоненты в покрытие не входят.
 */

import type { RitualDiagram as RitualDiagramData } from "@/core/domain/catalog/spell";
import {
  CENTER,
  VIEW_BOX,
  absolute,
  arcPath,
  inscriptionPlacements,
  pointAt,
  squareSide,
  starPolygons,
  tickMarks,
} from "@/core/domain/catalog/diagram/geometry";
import { GLYPHS, SEALS, type GlyphId, type SealKind } from "@/core/domain/catalog/diagram/glyphs";
import { RUNES, RUNE_BY_CHAR } from "@/core/domain/catalog/diagram/futhark";
import type { Stroke } from "@/core/domain/catalog/diagram/strokes";

const DASH = "10 8";

/**
 * Штрих в своём боксе 100×100 — превращается в элемент SVG.
 *
 * `vectorEffect` стоит на каждой фигуре, а не на группе: атрибут не наследуется, и на `<g>` он не
 * делает ничего. Без него масштаб группы умножает толщину линии — печать в центре выходила жирной
 * втрое, а руны надписи истончались до волоска и на экране пропадали.
 */
function StrokeShape({ stroke }: { stroke: Stroke }) {
  const common = {
    vectorEffect: "non-scaling-stroke" as const,
    ...(stroke.dashed === true ? { strokeDasharray: DASH } : {}),
  };

  if (stroke.kind === "circle") {
    return <circle cx={stroke.cx} cy={stroke.cy} r={stroke.r} {...common} />;
  }
  if (stroke.kind === "line") {
    return <line x1={stroke.x1} y1={stroke.y1} x2={stroke.x2} y2={stroke.y2} {...common} />;
  }
  if (stroke.kind === "arc") {
    return (
      <path
        d={arcPath(stroke.cx, stroke.cy, stroke.r, stroke.fromDegrees, stroke.toDegrees)}
        {...common}
      />
    );
  }
  const points = stroke.points.map(([x, y]) => `${x},${y}`).join(" ");
  return stroke.closed === true ? (
    <polygon points={points} {...common} />
  ) : (
    <polyline points={points} {...common} />
  );
}

/** Набор штрихов, поставленный в точку и масштабированный под размер. */
function Shape({
  strokes,
  x,
  y,
  size,
  rotation = 0,
}: {
  strokes: Stroke[];
  x: number;
  y: number;
  size: number;
  rotation?: number;
}) {
  const scale = size / 100;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale}) translate(-50 -50)`}>
      {strokes.map((stroke, index) => (
        <StrokeShape key={index} stroke={stroke} />
      ))}
    </g>
  );
}

function Glyph({ id, x, y, size, rotation }: { id: GlyphId; x: number; y: number; size: number; rotation?: number }) {
  return <Shape strokes={GLYPHS[id]} x={x} y={y} size={size} rotation={rotation ?? 0} />;
}

function Seal({ kind, radius }: { kind: SealKind; radius: number }) {
  return (
    <g data-layer="central-seal">
      <Shape strokes={SEALS[kind]} x={CENTER} y={CENTER} size={absolute(radius) * 2} />
    </g>
  );
}

function MagicSquare({ rows, radius }: { rows: number[][]; radius: number }) {
  const side = squareSide(absolute(radius));
  const cell = side / 3;
  const left = CENTER - side / 2;
  const top = CENTER - side / 2;

  return (
    <g data-layer="magic-square">
      {[0, 1, 2, 3].map((index) => (
        <line key={`h${index}`} x1={left} y1={top + cell * index} x2={left + side} y2={top + cell * index} />
      ))}
      {[0, 1, 2, 3].map((index) => (
        <line key={`v${index}`} x1={left + cell * index} y1={top} x2={left + cell * index} y2={top + side} />
      ))}
      {rows.flatMap((row, rowIndex) =>
        row.map((value, columnIndex) => (
          <text
            key={`${rowIndex}-${columnIndex}`}
            x={left + cell * (columnIndex + 0.5)}
            y={top + cell * (rowIndex + 0.5)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={cell * 0.42}
            fill="currentColor"
            stroke="none"
          >
            {value}
          </text>
        )),
      )}
    </g>
  );
}

export function RitualDiagram({ diagram }: { diagram: RitualDiagramData }) {
  const inscription = diagram.inscription;
  const radialGlyphs = diagram.radialGlyphs;
  const crossAxes = diagram.crossAxes;
  const runeSize = absolute(0.06);

  // Надпись разбирается на знаки заранее: посимвольный перебор строки, а не.split(""), — руны
  // лежат вне BMP только частично, но перебор честнее и не зависит от этого.
  const runes = inscription === undefined ? [] : [...inscription.runes];
  const placements =
    inscription === undefined ? [] : inscriptionPlacements(runes.length, absolute(inscription.radius));

  return (
    <svg
      viewBox={VIEW_BOX}
      role="img"
      aria-label="Схема ритуала"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      className="h-auto w-full"
    >
      {diagram.rings.map((fraction) => (
        <circle key={fraction} data-layer="ring" cx={CENTER} cy={CENTER} r={absolute(fraction)} />
      ))}

      {diagram.tickRing === undefined
        ? null
        : tickMarks(diagram.tickRing.count, absolute(diagram.tickRing.radius), absolute(0.03)).map(
            ([outer, inner], index) => (
              <line
                key={index}
                data-layer="tick"
                x1={outer.x}
                y1={outer.y}
                x2={inner.x}
                y2={inner.y}
              />
            ),
          )}

      {runes.map((char, index) => {
        const place = placements[index];
        const id = RUNE_BY_CHAR.get(char);
        if (place === undefined || id === undefined) return null;
        return (
          <g key={index} data-layer="inscription-rune">
            <Shape
              strokes={RUNES[id].strokes}
              x={place.at.x}
              y={place.at.y}
              size={runeSize}
              rotation={place.rotation}
            />
          </g>
        );
      })}

      {diagram.star === undefined
        ? null
        : starPolygons(diagram.star.points, diagram.star.skip, absolute(diagram.star.radius)).map(
            (cycle, index) => (
              <polygon
                key={index}
                data-layer="star-cycle"
                points={cycle.map((point) => `${point.x},${point.y}`).join(" ")}
              />
            ),
          )}

      {radialGlyphs === undefined
        ? null
        : radialGlyphs.glyphs.map((id, index) => {
            const at = pointAt(absolute(radialGlyphs.radius), index, radialGlyphs.glyphs.length);
            return (
              <g key={`${id}-${index}`} data-layer="radial-glyph">
                <Glyph id={id} x={at.x} y={at.y} size={absolute(0.09)} />
              </g>
            );
          })}

      {crossAxes === undefined
        ? null
        : Array.from({ length: crossAxes.count }, (_unused, index) => {
            const at = pointAt(absolute(crossAxes.radius), index, crossAxes.count);
            return (
              <line key={index} data-layer="cross-axis" x1={CENTER} y1={CENTER} x2={at.x} y2={at.y} />
            );
          })}

      {diagram.magicSquare === undefined ? null : (
        <MagicSquare rows={diagram.magicSquare.rows} radius={diagram.magicSquare.radius} />
      )}

      <Seal kind={diagram.centralSeal.kind} radius={diagram.centralSeal.radius} />

      {diagram.cornerMarks === undefined
        ? null
        : diagram.cornerMarks.map((id, index) => {
            // По углам листа, а не на осях: диагонали — это index * 2 + 1 из восьми направлений.
            const corner = pointAt(absolute(1.06), index * 2 + 1, 8);
            return (
              <g key={`${id}-${index}`} data-layer="corner-mark">
                <Glyph id={id} x={corner.x} y={corner.y} size={absolute(0.07)} />
              </g>
            );
          })}
    </svg>
  );
}
