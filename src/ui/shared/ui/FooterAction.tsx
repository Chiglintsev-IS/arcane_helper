"use client";

import type { ReactNode } from "react";

import { RULE_MARK } from "@/ui/shared/ui/rule";
import { SURFACE_DISABLED, SURFACE_PANEL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

/** Действие сверх названного предела не гасят: разрешить его вправе стол, а вид говорит о цене. */
const WARNED = `${TONE_TEXT.reaction} ${RULE_MARK.reaction}`;

/**
 * Одно действие страницы, закреплённое внизу: до него дотягивается большой палец, и оно не уезжает
 * вместе с прокруткой. Над кнопкой встаёт то, что о ней надо знать до нажатия.
 */
export function FooterAction({
  labelRu,
  noteRu = null,
  above = null,
  warning = false,
  disabled = false,
  onAct,
}: {
  labelRu: string;
  noteRu?: string | null;
  above?: ReactNode;
  warning?: boolean;
  disabled?: boolean;
  onAct: () => void;
}) {
  return (
    <div className={`shrink-0 ${SURFACE_PANEL}`}>
      {above}
      <button
        type="button"
        disabled={disabled}
        onClick={onAct}
        className={`flex h-[2.875rem] w-full flex-col items-center justify-center px-3 ${
          warning ? WARNED : SURFACE_PRIMARY
        } ${SURFACE_DISABLED} disabled:text-ink-quiet`}
      >
        <span className="text-sm font-semibold leading-tight">{labelRu}</span>
        {noteRu === null ? null : (
          <span className="text-[0.625rem] leading-tight">{noteRu}</span>
        )}
      </button>
    </div>
  );
}
