"use client";

import type { SheetView } from "@/contract/views";
import { sheetBlocks, type SheetEdit } from "../model/rows";
import { SheetBlock } from "./SheetBlock";

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
