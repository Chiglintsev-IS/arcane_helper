/**
 * Подписи к словам ремесла: ступени редкости, ступени усиления и направления алхимии.
 *
 * Домен отдаёт слово правил, подпись к нему выбирает отображение — и выбирает один раз: одно и то
 * же «редкое» читают и строка знания, и совпавшее свойство на верстаке.
 */

import type { PreviewOf } from "@/contract/questions";

import { CURRENCY_ABBREVIATIONS, withPlural } from "@/shared/language";

/** Ступени редкости словами. */
export const RARITY_LABELS: Readonly<Record<string, string>> = {
  common: "обычное",
  uncommon: "необычное",
  rare: "редкое",
  veryRare: "очень редкое",
  legendary: "легендарное",
};

/** Ступени усиления словами: сколько разных источников — столько и силы. */
export const TIER_LABELS: Readonly<Record<string, string>> = {
  plain: "обычная",
  amplified: "усиленная",
  concentrated: "концентрированная",
};

/** Направления алхимии словами. */
export const DIRECTION_LABELS: Readonly<Record<string, string>> = {
  potions: "зельеварение",
  poisons: "синтез ядов",
  transmutation: "трансмутация",
};

/** Номер свойства ординалом: он говорит, насколько глубоко оно было скрыто, а не сколько его. */
export function propertyNumberRu(number: number): string {
  return `${number}-е`;
}

/** Слово по коду, а незнакомый код — сам собой: выдумывать перевод отображению не из чего. */
export function labelled(labels: Readonly<Record<string, string>>, code: string): string {
  return labels[code] ?? code;
}

const MINUTES_PER_HOUR = 60;

/** Время работы коротко: до часа — минутами, дальше — часами. Так его меряет и партия, и глубина. */
export function minutesRu(minutes: number): string {
  return minutes < MINUTES_PER_HOUR ? `${minutes} мин` : `${minutes / MINUTES_PER_HOUR} ч`;
}

const PORTION_FORMS: [string, string, string] = ["порция", "порции", "порций"];

/**
 * Цена исследования одной строкой: время, расход порций и расходники.
 *
 * Порции приходят двумя числами, и сводит их в одну фразу отображение: первое свойство теряет
 * порцию только при провале, и «одна порция» без этой оговорки обещало бы расход, которого при
 * удаче не бывает.
 */
export function researchCostRu(plan: NonNullable<PreviewOf<"research_preview">["plan"]>): string {
  const portions =
    plan.portionsOnSuccess === plan.portionsOnFailure
      ? `${withPlural(plan.portionsOnFailure, PORTION_FORMS)} при любом исходе`
      : `${withPlural(plan.portionsOnFailure, PORTION_FORMS)} только при провале`;
  const consumables =
    plan.consumablesRu === null
      ? "без расходников"
      : `расходники ${plan.consumablesRu.toLowerCase()}, ` +
        `${plan.consumablesGold} ${CURRENCY_ABBREVIATIONS.gold}`;

  return `${minutesRu(plan.minutes)} · ${portions} · ${consumables}`;
}
