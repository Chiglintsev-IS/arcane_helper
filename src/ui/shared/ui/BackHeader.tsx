"use client";

import type { ReactNode } from "react";

import { RULE_EDGE_BOTTOM } from "@/ui/shared/ui/rule";

const BACK_MARK = "←";

/**
 * Шапка страницы, которая одновременно и заголовок, и возврат: на телефоне отдельная кнопка «назад»
 * занимает строку, ничего к ней не добавляя.
 */
export function BackHeader({
  titleRu,
  backNameRu,
  aside = null,
  onBack,
}: {
  titleRu: string;
  /** Как зовётся возврат для читающего вслух: заголовок сам по себе о нём не говорит. */
  backNameRu: string;
  aside?: ReactNode;
  onBack: () => void;
}) {
  return (
    <div className={`flex shrink-0 items-center gap-2 pr-3 ${RULE_EDGE_BOTTOM}`}>
      <button
        type="button"
        aria-label={backNameRu}
        onClick={onBack}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 text-left text-base font-semibold"
      >
        <span aria-hidden="true" className="shrink-0 text-accent">
          {BACK_MARK}
        </span>
        <span className="truncate">{titleRu}</span>
      </button>
      {aside}
    </div>
  );
}
