import type { RecipeFormulaView } from "@/contract/commands";
import type { PreviewOf } from "@/contract/questions";
import type { ChoicesView } from "@/contract/views";

import { CURRENCY_ABBREVIATIONS, coinRu, withPlural } from "@/shared/language";
import type { Tone } from "@/ui/shared/ui/tone";

/**
 * Тон направления: у каждого направления свой навык и своё оснащение, и на странице вида они
 * различаются раньше слов — цветом кромки слота. Цвет приходит из общей линейки значений.
 */
export const DIRECTION_TONE: Readonly<Record<string, Tone>> = {
  "Зельеварение": "ritual",
  "Синтез ядов": "damage",
  "Трансмутация": "action",
};

export function directionTone(dirRu: string | null): Tone {
  return dirRu === null ? "muted" : (DIRECTION_TONE[dirRu] ?? "bonus");
}

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

export function portionsRu(portions: number): string {
  return withPlural(portions, PORTION_FORMS);
}

/** «По столько-то с каждого вида»: счёт при предлоге склоняется иначе, чем счёт сам по себе. */
const PER_KIND_FORMS: [string, string, string] = ["порции", "порции", "порций"];

export function perKindPortionsRu(portions: number): string {
  return withPlural(portions, PER_KIND_FORMS);
}

const UNIT_FORMS: [string, string, string] = ["единица", "единицы", "единиц"];

export function unitsRu(units: number): string {
  return withPlural(units, UNIT_FORMS);
}

/** Ставка расходников: цена комплекта за начатый час — её платят, сколько бы минут ни ушло. */
export function goldPerHourRu(gold: number): string {
  return `${gold} ${CURRENCY_ABBREVIATIONS.gold}/ч`;
}

export function goldTotalRu(gold: number): string {
  return `${gold} ${CURRENCY_ABBREVIATIONS.gold}`;
}

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

/** Монета цены расходников: та же, какой справочник называет тарифы. */
const GOLD = "gold";

/**
 * Чего работа требует от инструмента — по справочнику, а не по нашей сумке: книга нашего набора не
 * знает. Профильность называется здесь же: непрофильным свойство раскрыть нельзя.
 */
const LABORATORY_RU = "профильная стационарная лаборатория";
const FIELD_TOOLS_RU = "профильные походные инструменты";

/**
 * Чего стоит исследование: каждое требование своей строкой и полным словом. В одну строку они не
 * складываются — там их читают как перечень сокращений, а не как условия работы.
 */
export function researchNeedsRu(
  plan: NonNullable<PreviewOf<"research_preview">["plan"]>,
): readonly ResearchNeed[] {
  const outcomeRu =
    plan.portionsOnSuccess === plan.portionsOnFailure
      ? "при любом исходе"
      : "только при провале";

  return [
    { labelRu: "Время", valueRu: minutesRu(plan.minutes) },
    {
      labelRu: "Порции",
      valueRu: `${portionsRu(plan.portionsOnFailure)} ${outcomeRu}`,
    },
    {
      labelRu: "Расходники",
      valueRu:
        plan.consumablesRu === null
          ? NO_CONSUMABLES_RU
          : `${plan.consumablesRu.toLowerCase()}, ${coinRu(plan.consumablesGold, GOLD)}`,
    },
    { labelRu: "Оснащение", valueRu: plan.laboratory ? LABORATORY_RU : FIELD_TOOLS_RU },
  ];
}

const PURIFIED_RU = "очистка смеси";

function repeatsRu(repeats: number): string {
  return `повторов в полную силу: ${repeats}`;
}

function suppressedRu(nameRu: string): string {
  return `подавлено: ${nameRu}`;
}

/**
 * Чем замысел отличается от стандартной формы справочника: стандартное не называется, потому что
 * оно и есть умолчание. Пустой перечень читается как «форма стандартная».
 */
export function formulaAsideRu(
  formula: RecipeFormulaView,
  standard: ChoicesView["recipeForm"]["standard"],
): readonly string[] {
  return [
    ...(formula.duration === standard.duration || formula.duration === null
      ? []
      : [formula.duration]),
    ...(formula.onset === standard.onset ? [] : [formula.onset]),
    ...(formula.reach === standard.reach ? [] : [formula.reach]),
    ...(formula.application === standard.application ? [] : [formula.application]),
    ...(formula.resistance === standard.resistance ? [] : [formula.resistance]),
    ...(formula.mainRarity === standard.mainRarity ? [] : [formula.mainRarity]),
    ...(formula.fullRepeats === standard.fullRepeats ? [] : [repeatsRu(formula.fullRepeats)]),
    ...(formula.purified ? [PURIFIED_RU] : []),
    ...formula.suppressed.map((one) => suppressedRu(one.nameRu)),
    ...formula.limitations,
  ];
}
