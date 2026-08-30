import type { DiagramFigure, DiagramView } from "@/contract/views";

const DASH = "10 8";

function Figure({ figure }: { figure: DiagramFigure }) {
  if (figure.kind === "number") {
    return (
      <text
        x={figure.at.x}
        y={figure.at.y}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={figure.size}
        fill="currentColor"
        stroke="none"
      >
        {figure.value}
      </text>
    );
  }

  const common = {
    vectorEffect: "non-scaling-stroke" as const,
    ...(figure.dashed === true ? { strokeDasharray: DASH } : {}),
  };

  if (figure.kind === "circle") {
    return <circle cx={figure.at.x} cy={figure.at.y} r={figure.radius} {...common} />;
  }
  if (figure.kind === "line") {
    return (
      <line x1={figure.from.x} y1={figure.from.y} x2={figure.to.x} y2={figure.to.y} {...common} />
    );
  }
  if (figure.kind === "arc") {
    const flags = `${figure.largeArc ? 1 : 0} ${figure.sweep ? 1 : 0}`;
    return (
      <path
        d={`M ${figure.from.x} ${figure.from.y} A ${figure.radius} ${figure.radius} 0 ${flags} ${figure.to.x} ${figure.to.y}`}
        {...common}
      />
    );
  }

  const points = figure.points.map((point) => `${point.x},${point.y}`).join(" ");
  return figure.closed === true ? (
    <polygon points={points} {...common} />
  ) : (
    <polyline points={points} {...common} />
  );
}

export function RitualDiagram({ diagram }: { diagram: DiagramView }) {
  return (
    <svg
      viewBox={`0 0 ${diagram.side} ${diagram.side}`}
      role="img"
      aria-label="Схема ритуала"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      className="h-auto w-full"
    >
      {diagram.marks.map((mark, index) => (
        <g key={index} data-layer={mark.layer}>
          {mark.figures.map((figure, place) => (
            <Figure key={place} figure={figure} />
          ))}
        </g>
      ))}
    </svg>
  );
}
