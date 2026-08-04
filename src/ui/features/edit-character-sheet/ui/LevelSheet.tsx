"use client";

import { useState } from "react";

import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import type { CharacterState } from "@/core/domain/assembly/state";
import { previewLevelChange, type LevelChange } from "@/core/application/useCases/sheet";
import { ARCANE_RECOVERY_LABEL, DERIVED_LABELS } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

/** Подпись сдвинутой величины: слово — дело отображения, числа приходят из ядра. */
const CHANGE_LABELS: Record<Exclude<LevelChange["of"], "slots">, string> = {
  runes: "Руны",
  arcaneRecovery: ARCANE_RECOVERY_LABEL,
  hitDice: "Кости хитов",
  preparedLimit: DERIVED_LABELS.preparedLimit,
};

function changeLine(change: LevelChange): string {
  const label =
    change.of === "slots" ? `Ячейки ${change.slotLevel} уровня` : CHANGE_LABELS[change.of];
  return `${label}: ${change.before} → ${change.after}`;
}

export function LevelSheet({
  character,
  onSave,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  character: CharacterState;
  onSave: (next: { level: number; hitPointMaximumBase: number }) => void;
  onCancel: () => void;
}) {
  const [levelText, setLevelText] = useState(String(character.level));
  const [maximumText, setMaximumText] = useState(String(character.hitPoints.maximumBase));

  const level = requiredFieldNumber(levelText);
  const maximum = requiredFieldNumber(maximumText);
  // Что изменится, считает сценарий; пустой перечень означает «считать нечего».
  const preview = previewLevelChange(character, level);

  return (
    <EditSheetFrame
      titleRu="Уровень"
      error={error}
      onCancel={onCancel}
      onSave={() => onSave({ level, hitPointMaximumBase: maximum })}
    >
      <NumberField
        labelRu="Уровень"
        value={levelText}
        onChange={setLevelText}
        min={MINIMUM_CHARACTER_LEVEL}
        max={MAXIMUM_CHARACTER_LEVEL}
      />
      <NumberField
        labelRu="Базовый максимум хитов"
        value={maximumText}
        onChange={setMaximumText}
        min={1}
      />

      {/* Кость бросает игрок: приложение называет среднее, но не подставляет его. */}
      {preview.hitPoints === null ? null : (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          За взятый уровень среднее за уровень: +{preview.hitPoints.total} (
          {preview.hitPoints.perDie} за d{preview.hitPoints.dieSize} и{" "}
          {preview.hitPoints.constitution} за Телосложение).
        </p>
      )}

      {preview.changes.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-xs text-slate-600 dark:text-slate-400">
          {preview.changes.map((change) => (
            <li key={changeLine(change)}>{changeLine(change)}</li>
          ))}
        </ul>
      ) : null}
    </EditSheetFrame>
  );
}
