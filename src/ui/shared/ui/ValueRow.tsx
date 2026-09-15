"use client";

import { RULE_ROW } from "@/ui/shared/ui/rule";

export const NOT_WRITTEN = "не записано";

/** Строка записанного: слева, о чём она, справа — что записано. Нажатие открывает правку. */
export function ValueRow({
  labelRu,
  valueRu,
  onOpen,
}: {
  labelRu: string;
  valueRu: string | null;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex min-h-11 w-full items-baseline justify-between gap-3 py-2 text-left ${RULE_ROW}`}
    >
      <span className="shrink-0 text-xs text-ink-quiet">{labelRu}</span>
      <span className={`min-w-0 text-right text-[0.8125rem] ${valueRu === null ? "text-off" : ""}`}>
        {valueRu ?? NOT_WRITTEN}
      </span>
    </button>
  );
}
