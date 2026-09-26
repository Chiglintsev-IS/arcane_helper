"use client";

import { useState, type ReactNode } from "react";

import type { ChoicesView, SheetView } from "@/contract/views";
import {
  IdentityFieldForm,
  type IdentityPatch,
} from "@/ui/features/edit-character-sheet/ui/IdentityFieldForm";
import { LevelForm } from "@/ui/features/edit-character-sheet/ui/LevelForm";
import type { WriteAnswer } from "@/ui/shared/ui/FieldForm";

import { sheetBlocks, type SheetField, type SheetRow } from "../model/rows";
import { SheetBlock } from "./SheetBlock";

export function CharacterSheet({
  sheet,
  choices,
  onWriteIdentity,
  onWriteLevel,
}: {
  sheet: SheetView;
  choices: ChoicesView;
  onWriteIdentity: (patch: IdentityPatch) => WriteAnswer;
  onWriteLevel: (next: { level: number; hitPointMaximumBase: number }) => WriteAnswer;
}) {
  const [opened, setOpened] = useState<SheetField | null>(null);
  const close = (): void => setOpened(null);

  const formOf = (row: SheetRow): ReactNode =>
    row.field === "level" ? (
      <LevelForm
        ownerRu={sheet.name}
        level={sheet.level}
        hitPoints={sheet.hitPoints}
        choices={choices}
        onWrite={onWriteLevel}
        onClose={close}
      />
    ) : (
      <IdentityFieldForm
        field={row.field}
        labelRu={row.labelRu}
        sheet={sheet}
        choices={choices}
        onWrite={onWriteIdentity}
        onClose={close}
      />
    );

  return (
    <div className="flex flex-col gap-2">
      {sheetBlocks(sheet).map((block) => (
        <SheetBlock
          key={block.id}
          block={block}
          opened={opened}
          formOf={formOf}
          onOpen={setOpened}
        />
      ))}
    </div>
  );
}
