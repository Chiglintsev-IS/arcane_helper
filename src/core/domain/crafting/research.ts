import { DomainError } from "@/core/domain/shared/errors";
import { apparatusLimits } from "./apparatus";
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

const WITHOUT_KIT_RU =
  "Точного исследования без набора не бывает: импровизированными сосудами свойство не раскрыть";

function neededApparatusRu(stationary: boolean, hardest: number | null, apparatus: string): string {
  const limit = hardest === null ? "" : ` с пределом сложности от ${hardest}`;
  return `Нужен ${stationary ? "стационарный " : ""}набор${limit}: записан «${apparatus}»`;
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
  /** Работа такой глубины идёт в стационарной лаборатории: это правило справочника, не наш набор. */
  readonly laboratory: boolean;
  readonly requirementRu: string | null;
};

/**
 * Чего работа требует от оснащения сверх записанного. Цена номера — строка справочника, и она
 * названа при любом наборе: годность набора не делает время и сложность неизвестными.
 */
function apparatusRequirement(
  step: (typeof RESEARCH_STEPS)[number],
  apparatus: Apparatus,
): string | null {
  if (apparatus === undefined) return WITHOUT_KIT_RU;

  const kit = apparatusLimits(apparatus);
  const stationary = step.laboratory && !kit.stationary;
  const harder = step.difficulty > kit.hardest;
  if (!stationary && !harder) return null;

  return neededApparatusRu(stationary, harder ? step.difficulty : null, apparatus);
}

export function researchPlan(input: {
  readonly number: number;
  readonly apparatus: Apparatus;
}): ResearchPlan {
  const step = RESEARCH_STEPS[input.number - RAW_SAMPLE_NUMBER];
  if (step === undefined) throw new DomainError(unknownNumberRefusal(input.number));

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
    laboratory: step.laboratory,
    requirementRu: apparatusRequirement(step, input.apparatus),
  };
}
