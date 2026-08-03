"use client";

import { useState } from "react";

import { abilityModifier, preparedLimit, proficiencyBonus } from "@/core/domain/character/abilities";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import type { CharacterState } from "@/core/domain/character/state";
import { spellSlotsForLevel } from "@/core/domain/arcana/slots";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

/** Среднее за уровень для кости d6 — половина плюс один. */
const AVERAGE_PER_HIT_DIE = 4;

function changeLines(character: CharacterState, level: number): string[] {
  const before = spellSlotsForLevel(character.level);
  const after = spellSlotsForLevel(level);
  const lines: string[] = [];

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const slotLevel = Number(key);
    const was = before[slotLevel]?.maximum ?? 0;
    const now = after[slotLevel]?.maximum ?? 0;
    if (was !== now) lines.push(`Ячейки ${slotLevel} уровня: ${was} → ${now}`);
  }

  const runesBefore = proficiencyBonus(character.level);
  const runesAfter = proficiencyBonus(level);
  if (runesBefore !== runesAfter) lines.push(`Руны: ${runesBefore} → ${runesAfter}`);

  if (character.hitDice !== undefined && character.hitDice.total !== level) {
    lines.push(`Кости хитов: ${character.hitDice.total} → ${level}`);
  }

  const limitBefore = preparedLimit(character.abilities.intelligence, character.level);
  const limitAfter = preparedLimit(character.abilities.intelligence, level);
  if (limitBefore !== limitAfter) lines.push(`Лимит подготовки: ${limitBefore} → ${limitAfter}`);

  return lines;
}

export function LevelSheet({
  character,
  onSave,
  onCancel,
}: {
  character: CharacterState;
  onSave: (next: { level: number; hitPointMaximumBase: number }) => void;
  onCancel: () => void;
}) {
  const [levelText, setLevelText] = useState(String(character.level));
  const [maximumText, setMaximumText] = useState(String(character.hitPoints.maximumBase));

  const level = Number.parseInt(levelText, 10);
  const maximum = Number.parseInt(maximumText, 10);
  const levelValid =
    Number.isInteger(level) && level >= MINIMUM_CHARACTER_LEVEL && level <= MAXIMUM_CHARACTER_LEVEL;
  const valid = levelValid && Number.isInteger(maximum) && maximum > 0;
  const constitution = abilityModifier(character.abilities.constitution);

  return (
    <EditSheetFrame
      titleRu="Уровень"
      canSave={valid}
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
      <p className="text-xs text-slate-600 dark:text-slate-400">
        За взятый уровень среднее за уровень: +{AVERAGE_PER_HIT_DIE + constitution} (
        {AVERAGE_PER_HIT_DIE} за d6 и {constitution} за Телосложение).
      </p>

      {levelValid ? (
        <ul className="flex flex-col gap-0.5 text-xs text-slate-600 dark:text-slate-400">
          {changeLines(character, level).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </EditSheetFrame>
  );
}
