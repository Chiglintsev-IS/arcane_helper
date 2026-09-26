"use client";

import { useState } from "react";

import type { AbilityView, ChoicesView } from "@/contract/views";
import { abilityLabel, skillLabel, trainingLabel } from "@/ui/entities/character/lib/labels";
import { requiredFieldNumber, useRequiredNumbers } from "@/ui/shared/lib/fieldNumber";
import { BUTTON_LABELS } from "@/ui/shared/ui/buttonLabels";
import { FieldForm, UNSENT, type WriteAnswer } from "@/ui/shared/ui/FieldForm";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

import { NumberField } from "./EditSheetFrame";

type Skills = Record<string, string>;

function trainingChoices(
  trainings: ChoicesView["skillTrainings"],
): { training: string | undefined; labelRu: string }[] {
  return [
    { training: undefined, labelRu: "нет" },
    ...trainings.map((training) => ({ training, labelRu: trainingLabel(training) })),
  ];
}

export function AbilityForm({
  ownerRu,
  ability,
  choices,
  onWrite,
  onClose,
}: {
  ownerRu: string;
  ability: AbilityView;
  choices: ChoicesView;
  onWrite: (change: {
    ability: string;
    score: number;
    saveProficient: boolean;
    skills: Skills;
  }) => WriteAnswer;
  onClose: () => void;
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
    <FieldForm
      titleRu={abilityLabel(ability.id)}
      subtitleRu={ownerRu}
      answerRu={BUTTON_LABELS.save}
      onWrite={() => {
        required.ask([score], () => {});
        if (!required.typed(score)) return UNSENT;
        return onWrite({ ability: ability.id, score, saveProficient, skills });
      }}
      onClose={onClose}
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
        className={`min-h-11 px-3 text-sm ${
          saveProficient
          ? `${SURFACE_CHOSEN} font-medium`
          : `text-ink-quiet ${SURFACE_CONTROL}`
        }`}
      >
        Владение спасброском
      </button>

      {owned.map(({ id }) => (
        <div key={id} className="flex flex-col gap-1 text-sm">
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
                className={`min-h-11 px-2 text-xs ${
                  skills[id] === choice.training
                  ? `${SURFACE_CHOSEN} font-medium`
                  : `text-ink-quiet ${SURFACE_GROUP}`
                }`}
              >
                {choice.labelRu}
              </button>
            ))}
          </div>
        </div>
      ))}
    </FieldForm>
  );
}
