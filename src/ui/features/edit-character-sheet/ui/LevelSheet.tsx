"use client";

import { useState } from "react";

import type { PreviewOf } from "@/contract/questions";
import type { SheetView } from "@/contract/views";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import { ARCANE_RECOVERY_LABEL, DERIVED_LABELS } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { usePreview } from "@/ui/shared/model/usePreview";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

type LevelChangeView = PreviewOf<"level_preview">["changes"][number];

/**
 * Подпись сдвинутой величины: слово приезжает строкой правил, поэтому подпись ищется, а не берётся
 * ключом. Незнакомое слово показывается как есть — пропасть с экрана молча оно не вправе.
 */
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
  onSave,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  level: number;
  hitPoints: SheetView["hitPoints"];
  onSave: (next: { level: number; hitPointMaximumBase: number }) => void;
  onCancel: () => void;
}) {
  const [levelText, setLevelText] = useState(String(currentLevel));
  const [maximumText, setMaximumText] = useState(String(hitPoints.maximumBase));

  const level = requiredFieldNumber(levelText);
  const maximum = requiredFieldNumber(maximumText);
  // Незаполненное поле не спрашивают: что изменится «от пустого места», ответить нечем.
  const asked = Number.isNaN(level) ? null : { kind: "level_preview" as const, level };
  const preview = usePreview(asked);
  const shown = preview?.kind === "level_preview" ? preview : null;

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
      {shown?.hitPoints == null ? null : (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          За взятый уровень среднее за уровень: +{shown.hitPoints.total} (
          {shown.hitPoints.perDie} за d{shown.hitPoints.dieSize} и {shown.hitPoints.constitution} за
          Телосложение).
        </p>
      )}

      {shown === null || shown.changes.length === 0 ? null : (
        <ul className="flex flex-col gap-0.5 text-xs text-slate-600 dark:text-slate-400">
          {shown.changes.map((change) => (
            <li key={changeLine(change)}>{changeLine(change)}</li>
          ))}
        </ul>
      )}
    </EditSheetFrame>
  );
}
