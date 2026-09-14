import type { PreviewOf } from "@/contract/questions";

import { goldRu, timeSpanRu, withPlural } from "@/shared/language";

export const TIER_LABELS: Readonly<Record<string, string>> = {
  plain: "обычная",
  amplified: "усиленная",
  concentrated: "концентрированная",
};

const MINUTES_PER_HOUR = 60;

export function minutesRu(minutes: number): string {
  return minutes < MINUTES_PER_HOUR ? `${minutes} мин` : `${minutes / MINUTES_PER_HOUR} ч`;
}

const PORTION_FORMS: [string, string, string] = ["порция", "порции", "порций"];

/**
 * Запас вида: штуки сумки и порции верстака. Совпали числа — мера у вида штучная, и второй раз одно
 * и то же не называют.
 */
export function stockRu(stock: { inBag: number; portionsInBag: number }): string {
  const inBag = `в сумке ${stock.inBag}`;
  return stock.inBag === stock.portionsInBag
    ? inBag
    : `${inBag} · ${withPlural(stock.portionsInBag, PORTION_FORMS)}`;
}

export type ResearchNeed = { readonly labelRu: string; readonly valueRu: string };

const NO_CONSUMABLES_RU = "не нужны";

/**
 * Чего стоит исследование: каждое требование своей строкой и полным словом. В одну строку они не
 * складываются — там их читают как перечень сокращений, а не как условия работы.
 */
export function researchNeedsRu(
  plan: NonNullable<PreviewOf<"research_preview">["plan"]>,
): readonly ResearchNeed[] {
  const hours = plan.minutes / MINUTES_PER_HOUR;
  const timeRu =
    plan.minutes < MINUTES_PER_HOUR
      ? timeSpanRu("minute", plan.minutes)
      : timeSpanRu("hour", hours);
  const outcomeRu =
    plan.portionsOnSuccess === plan.portionsOnFailure
      ? "при любом исходе"
      : "только при провале";

  return [
    { labelRu: "Время", valueRu: timeRu },
    { labelRu: "Порции", valueRu: `${plan.portionsOnFailure} ${outcomeRu}` },
    {
      labelRu: "Расходники",
      valueRu:
        plan.consumablesRu === null
          ? NO_CONSUMABLES_RU
          : `${plan.consumablesRu.toLowerCase()}, ${goldRu(plan.consumablesGold)}`,
    },
  ];
}
