"use client";

import type { ItemView } from "@/contract/views";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

const GEAR = "gear";

export function StockControls({
  item,
  onAdjustBagCount,
  onAdjustWornCount,
}: {
  item: ItemView;
  onAdjustBagCount: (delta: number) => void;
  onAdjustWornCount: (delta: number) => void;
}) {
  return (
    <>
      {!item.kinds.includes(GEAR) ? null : item.wornCount === 0 ? (
        <button
          type="button"
          aria-label={`Надеть один: ${item.nameRu}`}
          disabled={item.bagCount === 0}
          onClick={() => onAdjustWornCount(1)}
          className={`min-h-11 px-2 text-xs font-medium text-action disabled:opacity-40 ${SURFACE_CONTROL}`}
        >
          надеть
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Снять один: ${item.nameRu}`}
          onClick={() => onAdjustWornCount(-1)}
          className={`min-h-11 px-2 text-xs ${SURFACE_CONTROL}`}
        >
          снять
        </button>
      )}
      <button
        type="button"
        aria-label={`Потратить один из сумки: ${item.nameRu}`}
        disabled={item.bagCount === 0}
        onClick={() => onAdjustBagCount(-1)}
        className={`min-h-11 min-w-11 text-base disabled:opacity-40 ${SURFACE_CONTROL}`}
      >
        −
      </button>
      <button
        type="button"
        aria-label={`Добавить один в сумку: ${item.nameRu}`}
        onClick={() => onAdjustBagCount(1)}
        className={`min-h-11 min-w-11 text-base ${SURFACE_CONTROL}`}
      >
        +
      </button>
    </>
  );
}
