"use client";

import type { CharacterState } from "@/core/domain/assembly/state";
import { sheetBlocks } from "../model/rows";
import { SheetBlock } from "./SheetBlock";

/**
 * Лист — одна колонка базы персонажа, без вкладок: вещи и деньги живут в «Сумке», действующие
 * числа боя — в шапке «Игры». Правится здесь только база; ситуативное — статусы, поправки,
 * временные хиты — вводится там, где действует: в «Игре».
 */
export function CharacterSheetScreen({
  character,
  onEdit,
}: {
  character: CharacterState;
  onEdit: (blockId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {sheetBlocks(character).map((block) => (
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
