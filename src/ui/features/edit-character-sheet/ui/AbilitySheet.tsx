"use client";

import { useState } from "react";

import { skillsOfAbility, type SkillTraining } from "@/core/domain/character/skills";
import type { Ability, SkillId } from "@/core/domain/shared/stats";
import type { CharacterState } from "@/core/domain/assembly/state";
import {
  MAXIMUM_ABILITY_SCORE,
  MINIMUM_ABILITY_SCORE,
} from "@/core/domain/character/abilities";
import { ABILITY_LABELS, SKILL_LABELS, TRAINING_LABELS } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";



type Skills = Partial<Record<SkillId, SkillTraining>>;

/** Три состояния навыка. Отсутствие владения — снятый ключ, а не третье значение в данных. */
const CHOICES: { training: SkillTraining | undefined; labelRu: string }[] = [
  { training: undefined, labelRu: "нет" },
  { training: "proficient", labelRu: TRAINING_LABELS.proficient },
  { training: "expert", labelRu: TRAINING_LABELS.expert },
];

/**
 * Правка одной характеристики: то же, что показывает её блок на листе.
 *
 * Шторка повторяет состав блока, а не собирает все шесть характеристик разом: правят одну, а
 * шесть значений в одном окне заставляли бы искать нужную строку среди чужих.
 */
export function AbilitySheet({
  ability,
  character,
  onSave,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  ability: Ability;
  character: CharacterState;
  onSave: (change: {
    ability: Ability;
    score: number;
    saveProficient: boolean;
    skills: Skills;
  }) => void;
  onCancel: () => void;
}) {
  const owned = skillsOfAbility(ability);
  const [scoreText, setScoreText] = useState(String(character.abilities[ability]));
  const [saveProficient, setSaveProficient] = useState(
    character.saveProficiencies.includes(ability),
  );
  const [skills, setSkills] = useState<Skills>(() =>
    Object.fromEntries(
      owned.filter((id) => character.skills[id] !== undefined).map((id) => [id, character.skills[id]]),
    ),
  );

  const score = requiredFieldNumber(scoreText);

  const setTraining = (id: SkillId, training: SkillTraining | undefined): void => {
    const { [id]: _dropped, ...rest } = skills;
    setSkills(training === undefined ? rest : { ...rest, [id]: training });
  };

  return (
    <EditSheetFrame
      titleRu={ABILITY_LABELS[ability]}
      error={error}
      onCancel={onCancel}
      onSave={() => onSave({ ability, score, saveProficient, skills })}
    >
      <NumberField
        labelRu="Значение"
        value={scoreText}
        onChange={setScoreText}
        min={MINIMUM_ABILITY_SCORE}
        max={MAXIMUM_ABILITY_SCORE}
      />

      <button
        type="button"
        role="switch"
        aria-checked={saveProficient}
        aria-label="Владение спасброском"
        onClick={() => setSaveProficient(!saveProficient)}
        className={`min-h-11 rounded-lg border px-3 text-sm ${
          saveProficient
            ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
            : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
        }`}
      >
        Владение спасброском
      </button>

      {owned.map((id) => (
        <div key={id} className="flex items-center justify-between gap-2 text-sm">
          <span>{SKILL_LABELS[id]}</span>
          <div role="radiogroup" aria-label={SKILL_LABELS[id]} className="flex gap-1">
            {CHOICES.map((choice) => (
              <button
                key={choice.labelRu}
                type="button"
                role="radio"
                aria-checked={skills[id] === choice.training}
                aria-label={choice.labelRu}
                onClick={() => setTraining(id, choice.training)}
                className={`min-h-11 rounded-lg border px-2 text-xs ${
                  skills[id] === choice.training
                    ? "border-action bg-action/10 font-medium text-action-strong dark:text-action"
                    : "border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-400"
                }`}
              >
                {choice.labelRu}
              </button>
            ))}
          </div>
        </div>
      ))}
    </EditSheetFrame>
  );
}
