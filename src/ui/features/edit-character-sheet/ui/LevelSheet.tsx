"use client";

import { useState } from "react";

import type { PreviewOf } from "@/contract/questions";
import type { ChoicesView, SheetView } from "@/contract/views";
import { ARCANE_RECOVERY_LABEL, DERIVED_LABELS } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber, useRequiredNumbers } from "@/ui/shared/lib/fieldNumber";
import { usePreview } from "@/ui/shared/model/usePreview";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

type LevelChangeView = PreviewOf<"level_preview">["changes"][number];

const CHANGE_LABELS: Readonly<Record<string, string>> = {
  runes: "Руны",
  arcaneRecovery: ARCANE_RECOVERY_LABEL,
  hitDice: "Кости хитов",
  preparedLimit: DERIVED_LABELS.preparedLimit,
};

function changeLine(change: LevelChangeView): string {
  const label =
    change.slotLevel === undefined
      ? (CHANGE_LABELS[change.of] ?? change.of)
      : `Ячейки ${change.slotLevel} уровня`;
  return `${label}: ${change.before} → ${change.after}`;
}

export function LevelSheet({
  level: currentLevel,
  hitPoints,
  choices,
  onSave,
  onCancel,
  error = null,
}: {
  error?: string | null;
  level: number;
  hitPoints: SheetView["hitPoints"];
  choices: ChoicesView;
  onSave: (next: { level: number; hitPointMaximumBase: number }) => void;
  onCancel: () => void;
}) {
  const [levelText, setLevelText] = useState(String(currentLevel));
  const [maximumText, setMaximumText] = useState(String(hitPoints.maximumBase));

  const required = useRequiredNumbers();
  const level = requiredFieldNumber(levelText);
  const maximum = requiredFieldNumber(maximumText);
  const question = required.allTyped([level]) ? { kind: "level_preview" as const, level } : null;
  const preview = usePreview(question);
  const shown = preview?.kind === "level_preview" ? preview : null;

  return (
    <EditSheetFrame
      titleRu="Уровень"
      error={error}
      onCancel={onCancel}
      onSave={() =>
        required.ask([level, maximum], () => onSave({ level, hitPointMaximumBase: maximum }))
      }
    >
      <NumberField
        labelRu="Уровень"
        value={levelText}
        onChange={required.touching(setLevelText)}
        min={choices.characterLevel.minimum}
        max={choices.characterLevel.maximum}
        reasonRu={required.reasonOf(level)}
      />
      <NumberField
        labelRu="Базовый максимум хитов"
        value={maximumText}
        onChange={required.touching(setMaximumText)}
        min={1}
        reasonRu={required.reasonOf(maximum)}
      />

      {shown?.hitPoints == null ? null : (
        <p className="text-xs text-ink-quiet">
          За взятый уровень среднее за уровень: +{shown.hitPoints.total} (
          {shown.hitPoints.perDie} за d{shown.hitPoints.dieSize} и {shown.hitPoints.constitution} за
          Телосложение).
        </p>
      )}

      {shown === null || shown.changes.length === 0 ? null : (
        <ul className="flex flex-col gap-0.5 text-xs text-ink-quiet">
          {shown.changes.map((change) => (
            <li key={changeLine(change)}>{changeLine(change)}</li>
          ))}
        </ul>
      )}
    </EditSheetFrame>
  );
}
