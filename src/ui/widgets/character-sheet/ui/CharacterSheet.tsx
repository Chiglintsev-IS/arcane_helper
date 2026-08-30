"use client";

import type { SheetView } from "@/contract/views";
import { sheetBlocks, type SheetEdit } from "../model/rows";
import { SheetBlock } from "./SheetBlock";

/**
 * Кто он: то, что спрашивают раз за вечер, а не в каждый ход.
 *
 * Числами, которыми бросают, карточки не заняты — они стоят гроссбухом на соседней вкладке. Вещи и
 * деньги живут в «Сумке», действующие числа боя и отметки мастера — в «Игре»: правится здесь только
 * то, что за бой не меняется.
 */
export function CharacterSheet({
  sheet,
  onEdit,
}: {
  sheet: SheetView;
  onEdit: (edit: SheetEdit) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {sheetBlocks(sheet).map((block) => (
        <SheetBlock key={block.id} block={block} onEdit={onEdit} />
      ))}
    </div>
  );
}
