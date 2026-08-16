"use client";

import { useState } from "react";

import type { AbilityView, ChoicesView } from "@/contract/views";
import { abilityLabel, skillLabel, trainingLabel } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber, useRequiredNumbers } from "@/ui/shared/lib/fieldNumber";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

/** Набранные владения: навык и степень словами правил — их же ждёт команда. */
type Skills = Record<string, string>;

/**
 * Три состояния навыка при двух степенях владения: отсутствие владения — снятый ключ, а не третья
 * степень, и потому в перечень правил оно не входит, а в выбор игрока входит.
 */
function trainingChoices(
  trainings: ChoicesView["skillTrainings"],
): { training: string | undefined; labelRu: string }[] {
  return [
    { training: undefined, labelRu: "нет" },
    ...trainings.map((training) => ({ training, labelRu: trainingLabel(training) })),
  ];
}

/**
 * Правка одной характеристики: то же, что показывает её блок на листе.
 *
 * Шторка повторяет состав блока, а не собирает все шесть характеристик разом: правят одну, а
 * шесть значений в одном окне заставляли бы искать нужную строку среди чужих.
 */
export function AbilitySheet({
  ability,
  choices,
  onSave,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  ability: AbilityView;
  /** Из чего выбирают и в каких границах набирают: степени владения и пределы значения. */
  choices: ChoicesView;
  onSave: (change: {
    ability: string;
    score: number;
    saveProficient: boolean;
    skills: Skills;
  }) => void;
  onCancel: () => void;
}) {
  const owned = ability.skills;
  const [scoreText, setScoreText] = useState(String(ability.score));
  const [saveProficient, setSaveProficient] = useState(ability.saveProficient);
  const [skills, setSkills] = useState<Skills>(() =>
    Object.fromEntries(
      owned.flatMap((skill) => (skill.training === undefined ? [] : [[skill.id, skill.training]])),
    ),
  );

  const required = useRequiredNumbers();
  const score = requiredFieldNumber(scoreText);

  const setTraining = (id: string, training: string | undefined): void => {
    const { [id]: _dropped, ...rest } = skills;
    setSkills(training === undefined ? rest : { ...rest, [id]: training });
  };

  return (
    <EditSheetFrame
      titleRu={abilityLabel(ability.id)}
      error={error}
      onCancel={onCancel}
      onSave={() =>
        required.ask([score], () => onSave({ ability: ability.id, score, saveProficient, skills }))
      }
    >
      <NumberField
        labelRu="Значение"
        value={scoreText}
        onChange={required.touching(setScoreText)}
        min={choices.abilityScore.minimum}
        max={choices.abilityScore.maximum}
        reasonRu={required.reasonOf(score)}
      />

      <button
        type="button"
        role="switch"
        aria-checked={saveProficient}
        aria-label="Владение спасброском"
        onClick={() => setSaveProficient(!saveProficient)}
        className={`min-h-11 rounded-lg px-3 text-sm ${
          saveProficient
            ? "bg-action/20 font-medium text-action-strong dark:text-action"
            : `text-slate-600 dark:text-slate-400 ${SURFACE_CONTROL}`
        }`}
      >
        Владение спасброском
      </button>

      {owned.map(({ id }) => (
        <div key={id} className="flex items-center justify-between gap-2 text-sm">
          <span>{skillLabel(id)}</span>
          <div role="radiogroup" aria-label={skillLabel(id)} className="flex gap-1">
            {trainingChoices(choices.skillTrainings).map((choice) => (
              <button
                key={choice.labelRu}
                type="button"
                role="radio"
                aria-checked={skills[id] === choice.training}
                aria-label={choice.labelRu}
                onClick={() => setTraining(id, choice.training)}
                className={`min-h-11 rounded-lg px-2 text-xs ${
                  skills[id] === choice.training
                    ? "bg-action/20 font-medium text-action-strong dark:text-action"
                    : `text-slate-600 dark:text-slate-400 ${SURFACE_GROUP}`
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
