/**
 * Исследование ингредиента: во что обойдётся раскрытие очередного свойства.
 *
 * Свойства раскрываются по порядку, и глубина стоит дорого: первое узнаётся за десять минут
 * походными инструментами, четвёртое — сутками в стационарной лаборатории. Между открытием и
 * применением проходят недели игры, и заранее видеть цену — то, ради чего этот счёт и нужен.
 *
 * Чем свойство окажется, здесь не решается: приложение считает время, сложность, порции и
 * расходники, а название и редкость приходят от стола.
 */

import type { AlchemyDirection } from "@/core/domain/catalog/alchemy";
import { DomainError } from "@/core/domain/shared/errors";
import { apparatusOf } from "./apparatus";
import type { Apparatus } from "./apparatus";
import { consumablesOf, startedHours } from "./consumables";
import type { RevealedProperty } from "./schema";

/** Глубокое исследование: время, базовая сложность, оснащение и расход порций по номеру. */
const RESEARCH_STEPS = [
  { minutes: 10, difficulty: 5, laboratory: false, portionsOnSuccess: 0, portionsOnFailure: 1 },
  { minutes: 60, difficulty: 12, laboratory: false, portionsOnSuccess: 1, portionsOnFailure: 1 },
  { minutes: 480, difficulty: 18, laboratory: true, portionsOnSuccess: 2, portionsOnFailure: 2 },
  { minutes: 1440, difficulty: 25, laboratory: true, portionsOnSuccess: 3, portionsOnFailure: 3 },
] as const;

/** К базовой сложности прибавляется модификатор редкости исследуемого свойства. */
const RARITY_RESEARCH_DIFFICULTY = {
  common: 0,
  uncommon: 1,
  rare: 2,
  veryRare: 4,
  legendary: 7,
} as const satisfies Record<RevealedProperty["rarity"], number>;

/** С этого номера исследование дополнительно жжёт алхимические материалы. */
const CONSUMABLES_FROM_NUMBER = 2;

/** Первое свойство — единственное, которое раскрывается и без броска, сырой пробой. */
const RAW_SAMPLE_NUMBER = 1;

const RAW_SAMPLE_RU =
  "Сырая проба: одна порция, первое свойство раскрывается сразу, исследователь подвергается его ослабленному проявлению.";

function unknownNumberRefusal(number: number): string {
  return `Глубже четвёртого свойства исследовать нечего, названо: ${number}`;
}

function withoutKitRefusal(): string {
  return "Точного исследования без профильного оснащения не бывает: непрофильные инструменты называют только чужое направление";
}

function laboratoryRefusal(number: number): string {
  return `Свойство под номером ${number} исследуют только в профильной стационарной лаборатории`;
}

function tooHardResearchRefusal(difficulty: number, hardest: number): string {
  return `Сложность исследования ${difficulty} выше предела оснащения ${hardest}`;
}

/**
 * Во что обойдётся раскрытие свойства: время, сложность, порции и расходники.
 *
 * Порции названы двумя числами, а не одним: первое свойство теряет порцию только при провале, и
 * «одна порция» без этой оговорки обещало бы расход, которого при удаче не бывает.
 */
export type ResearchPlan = {
  readonly number: number;
  readonly minutes: number;
  readonly difficulty: number;
  readonly portionsOnSuccess: number;
  readonly portionsOnFailure: number;
  /** Класс расходников и его цена за всю работу; нет вовсе — материалов эта глубина не жжёт. */
  readonly consumablesRu: string | null;
  readonly consumablesGold: number;
  /** Быстрый путь без броска; нет вовсе — этой глубины он не касается. */
  readonly rawSampleRu: string | null;
};

export function researchPlan(input: {
  readonly number: number;
  readonly rarity: RevealedProperty["rarity"];
  readonly direction: AlchemyDirection;
  readonly apparatus: Apparatus;
}): ResearchPlan {
  const step = RESEARCH_STEPS[input.number - RAW_SAMPLE_NUMBER];
  if (step === undefined) throw new DomainError(unknownNumberRefusal(input.number));

  const kit = apparatusOf(input.direction, input.apparatus);
  if (kit === undefined) throw new DomainError(withoutKitRefusal());
  if (step.laboratory && !kit.stationary) throw new DomainError(laboratoryRefusal(input.number));

  const difficulty = step.difficulty + RARITY_RESEARCH_DIFFICULTY[input.rarity];
  if (difficulty > kit.hardest) {
    throw new DomainError(tooHardResearchRefusal(difficulty, kit.hardest));
  }

  const burns = input.number >= CONSUMABLES_FROM_NUMBER;
  const consumables = consumablesOf(difficulty);
  return {
    number: input.number,
    minutes: step.minutes,
    difficulty,
    portionsOnSuccess: step.portionsOnSuccess,
    portionsOnFailure: step.portionsOnFailure,
    consumablesRu: burns ? consumables.nameRu : null,
    consumablesGold: burns ? consumables.goldPerStartedHour * startedHours(step.minutes) : 0,
    rawSampleRu: input.number === RAW_SAMPLE_NUMBER ? RAW_SAMPLE_RU : null,
  };
}
