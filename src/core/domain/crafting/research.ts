import { DomainError } from "@/core/domain/shared/errors";
import { apparatusOf } from "./apparatus";
import type { Apparatus } from "./apparatus";
import { consumablesOf, startedHours } from "./consumables";

const RESEARCH_STEPS = [
  { minutes: 10, difficulty: 5, laboratory: false, portionsOnSuccess: 0, portionsOnFailure: 1 },
  { minutes: 60, difficulty: 12, laboratory: false, portionsOnSuccess: 1, portionsOnFailure: 1 },
  { minutes: 480, difficulty: 18, laboratory: true, portionsOnSuccess: 2, portionsOnFailure: 2 },
  { minutes: 1440, difficulty: 25, laboratory: true, portionsOnSuccess: 3, portionsOnFailure: 3 },
] as const;

const CONSUMABLES_FROM_NUMBER = 2;

const RAW_SAMPLE_NUMBER = 1;

const RAW_SAMPLE_RU =
  "Сырая проба: одна порция, первое свойство раскрывается сразу, исследователь подвергается его ослабленному проявлению.";

function unknownNumberRefusal(number: number): string {
  return `Глубже четвёртого свойства исследовать нечего, названо: ${number}`;
}

function withoutKitRefusal(): string {
  return "Точного исследования без набора не бывает: импровизированными сосудами свойство не раскрыть";
}

function laboratoryRefusal(number: number): string {
  return `Свойство под номером ${number} исследуют только в стационарной лаборатории`;
}

function tooHardResearchRefusal(difficulty: number, hardest: number): string {
  return `Сложность исследования ${difficulty} выше предела оснащения ${hardest}`;
}

export type ResearchStep = {
  readonly number: number;
  readonly minutes: number;
  readonly difficulty: number;
  readonly laboratory: boolean;
  readonly portionsOnSuccess: number;
  readonly portionsOnFailure: number;
  readonly consumables: boolean;
  readonly rawSample: boolean;
};

/** Глубина исследования перечнем: та же таблица, по которой считается цена очередного номера. */
export function researchSteps(): readonly ResearchStep[] {
  return RESEARCH_STEPS.map((step, index) => {
    const number = index + RAW_SAMPLE_NUMBER;
    return {
      ...step,
      number,
      consumables: number >= CONSUMABLES_FROM_NUMBER,
      rawSample: number === RAW_SAMPLE_NUMBER,
    };
  });
}

export type ResearchPlan = {
  readonly number: number;
  readonly minutes: number;
  readonly difficulty: number;
  readonly portionsOnSuccess: number;
  readonly portionsOnFailure: number;
  readonly consumablesRu: string | null;
  readonly consumablesGold: number;
  readonly rawSampleRu: string | null;
};

export function researchPlan(input: {
  readonly number: number;
  readonly apparatus: Apparatus;
}): ResearchPlan {
  const step = RESEARCH_STEPS[input.number - RAW_SAMPLE_NUMBER];
  if (step === undefined) throw new DomainError(unknownNumberRefusal(input.number));

  const kit = apparatusOf(input.apparatus);
  if (kit === undefined) throw new DomainError(withoutKitRefusal());
  if (step.laboratory && !kit.stationary) throw new DomainError(laboratoryRefusal(input.number));

  if (step.difficulty > kit.hardest) {
    throw new DomainError(tooHardResearchRefusal(step.difficulty, kit.hardest));
  }

  const burns = input.number >= CONSUMABLES_FROM_NUMBER;
  const consumables = consumablesOf(step.difficulty);
  return {
    number: input.number,
    minutes: step.minutes,
    difficulty: step.difficulty,
    portionsOnSuccess: step.portionsOnSuccess,
    portionsOnFailure: step.portionsOnFailure,
    consumablesRu: burns ? consumables.nameRu : null,
    consumablesGold: burns ? consumables.goldPerStartedHour * startedHours(step.minutes) : 0,
    rawSampleRu: input.number === RAW_SAMPLE_NUMBER ? RAW_SAMPLE_RU : null,
  };
}
