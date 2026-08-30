"use client";

import { SURFACE_CHOSEN, SURFACE_GROUP } from "@/ui/shared/ui/surface";

export function Choices<TValue extends string>({
  labelRu,
  values,
  titles,
  chosen,
  onChoose,
}: {
  labelRu: string;
  values: readonly TValue[];
  titles: Readonly<Record<TValue, string>>;
  chosen: TValue;
  onChoose: (value: TValue) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={labelRu}
      className={`flex flex-wrap gap-0.5 p-0.5 ${SURFACE_GROUP}`}
    >
      {values.map((value) => {
        const selected = value === chosen;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChoose(value)}
            className={`min-h-11 grow px-2 text-sm ${
              selected ? `${SURFACE_CHOSEN} font-medium` : "text-ink-quiet"
            }`}
          >
            {titles[value]}
          </button>
        );
      })}
    </div>
  );
}
