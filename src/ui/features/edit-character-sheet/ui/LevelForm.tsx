"use client";

import { useState } from "react";

import type { PreviewOf } from "@/contract/questions";
import type { ChoicesView, SheetView } from "@/contract/views";
import { ARCANE_RECOVERY_LABEL, DERIVED_LABELS } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber, useRequiredNumbers } from "@/ui/shared/lib/fieldNumber";
import { usePreview } from "@/ui/shared/model/usePreview";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { FieldForm, UNSENT, type WriteAnswer } from "@/ui/shared/ui/FieldForm";

import { NumberField } from "./EditSheetFrame";

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

export const LEVEL_LABEL = "Уровень";

export function LevelForm({
  level: currentLevel,
  hitPoints,
  choices,
  onWrite,
  onClose,
}: {
  level: number;
  hitPoints: SheetView["hitPoints"];
  choices: ChoicesView;
  onWrite: (next: { level: number; hitPointMaximumBase: number }) => WriteAnswer;
  onClose: () => void;
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
    <FieldForm
      titleRu={LEVEL_LABEL}
      answerRu={BUTTON_LABELS.save}
      onWrite={() => {
        required.ask([level, maximum], () => {});
        if (!required.allTyped([level, maximum])) return UNSENT;
        return onWrite({ level, hitPointMaximumBase: maximum });
      }}
      onClose={onClose}
    >
      <NumberField
        labelRu={LEVEL_LABEL}
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
    </FieldForm>
  );
}
