import type { PreviewOf } from "@/contract/questions";

import { CURRENCY_ABBREVIATIONS, withPlural } from "@/shared/language";

export const TIER_LABELS: Readonly<Record<string, string>> = {
  plain: "обычная",
  amplified: "усиленная",
  concentrated: "концентрированная",
};

export const DIRECTION_LABELS: Readonly<Record<string, string>> = {
  potions: "зельеварение",
  poisons: "синтез ядов",
  transmutation: "трансмутация",
};

const MINUTES_PER_HOUR = 60;

export function minutesRu(minutes: number): string {
  return minutes < MINUTES_PER_HOUR ? `${minutes} мин` : `${minutes / MINUTES_PER_HOUR} ч`;
}

const PORTION_FORMS: [string, string, string] = ["порция", "порции", "порций"];

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
