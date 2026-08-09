"use client";

import type { ChoicesView, SheetView } from "@/contract/views";
import { sheetBlocks, type SheetEdit } from "../model/rows";
import { SheetBlock } from "./SheetBlock";

/**
 * Лист — одна колонка базы персонажа, без вкладок: вещи и деньги живут в «Сумке», действующие
 * числа боя — в шапке «Игры». Правится здесь только база; ситуативное — статусы, поправки,
 * временные хиты — вводится там, где действует: в «Игре».
 */
export function CharacterSheet({
  sheet,
  stats,
  onEdit,
}: {
  sheet: SheetView;
  /** Величины с разбором: ими подписаны строки постоянных вкладов. */
  stats: ChoicesView["stats"];
  onEdit: (edit: SheetEdit) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {sheetBlocks(sheet, stats).map((block) => (
        <SheetBlock
          key={block.id}
          block={block}
          onEdit={() => onEdit(block.edit)}
          onSecondaryEdit={() => onEdit(block.secondary?.edit ?? block.edit)}
        />
      ))}
    </div>
  );
}
