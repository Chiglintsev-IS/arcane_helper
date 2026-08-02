"use client";

import { useState } from "react";

import type { CharacterState } from "@/core/domain/character/state";
import { sheetBlocks, SHEET_TABS, type SheetTab } from "../model/rows";
import { SheetBlock } from "./SheetBlock";

/**
 * Подписи вкладок. «Итог» стоит первым: за столом спрашивают число, а не то, из чего оно сложилось.
 */
const TAB_LABELS: Record<SheetTab, string> = {
  total: "Итог",
  character: "Персонаж",
  equipment: "Экипировка",
  inventory: "Инвентарь",
};

export function CharacterSheetScreen({
  character,
  onEdit,
}: {
  character: CharacterState;
  onEdit: (blockId: string) => void;
}) {
  const [tab, setTab] = useState<SheetTab>("total");
  const blocks = sheetBlocks(character).filter((block) => block.tab === tab);

  return (
    <div className="flex flex-col gap-2">
      {/*
       * Вкладки, а не режимы экрана: пять кнопок переключателя режимов — предел на узком экране,
       * и шестой режим потребовал бы другого способа переключения.
       */}
      <div role="tablist" aria-label="Разделы листа" className="flex gap-1">
        {SHEET_TABS.map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={tab === option}
            onClick={() => setTab(option)}
            className={`min-h-11 flex-1 rounded-lg border px-2 text-sm ${
              tab === option
                ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
                : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
            }`}
          >
            {TAB_LABELS[option]}
          </button>
        ))}
      </div>

      {blocks.map((block) => (
        <SheetBlock
          key={block.id}
          block={block}
          onEdit={() => onEdit(block.editId)}
          onSecondaryEdit={() => onEdit(block.secondary?.editId ?? block.editId)}
        />
      ))}
    </div>
  );
}
