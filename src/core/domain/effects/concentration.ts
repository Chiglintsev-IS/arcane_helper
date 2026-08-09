import { DomainError } from "@/core/domain/shared/errors";
import type { ActiveEffect } from "./schema";

import { withPlural } from "@/shared/language";

export const MINIMUM_CONCENTRATION_DC = 10;

const ROUNDS_PER_MINUTE = 10;
const ROUNDS_PER_HOUR = 600;

/** Дольше десяти раундов перевод перестаёт помогать: столько длится бой, и эффект доживёт в любом случае. */
const MAXIMUM_USEFUL_ROUNDS = 10;

const ROUND_FORMS: [string, string, string] = ["раунд", "раунда", "раундов"];
const ROUND_FORMS_GENITIVE: [string, string, string] = ["раунда", "раундов", "раундов"];

function roundsHint(rounds: number): string {
  return rounds > MAXIMUM_USEFUL_ROUNDS ? "" : ` (${withPlural(rounds, ROUND_FORMS)})`;
}

/** Записи журнала в том объёме, который нужен для счёта раундов. */
type TurnMark = { at: string; kind: string };

type StartRound = {
  round: number;
  /** Начало вытеснено из обрезанного журнала: число — нижняя граница, а не точное значение. */
  approximate: boolean;
};

export function startRound(marks: readonly TurnMark[], startedAt: string): StartRound {
  const turnsBefore = marks.filter(
    (mark) => mark.kind === "turn_started" && mark.at <= startedAt,
  ).length;
  const earliest = marks[0];
  return {
    round: Math.max(1, turnsBefore),
    approximate: earliest === undefined || earliest.at > startedAt,
  };
}

/**
 * Длительность словами: за столом время считают раундами, а карточка заклинания — минутами.
 *
 * Предлог входит в строку, потому что требует родительного падежа: склейка «до » с именительным
 * дала бы «до 3 раунда». Особая длительность предлога не получает — сроку, которого нет, границы
 * не назовёшь.
 */
export function durationWithRoundsRu(duration: ActiveEffect["duration"]): string {
  const value = duration.value ?? 0;
  switch (duration.type) {
    case "rounds":
      return `до ${withPlural(value, ROUND_FORMS_GENITIVE)}`;
    case "minutes":
      return `до ${withPlural(value, ["минуты", "минут", "минут"])}${roundsHint(value * ROUNDS_PER_MINUTE)}`;
    case "hours":
      return `до ${withPlural(value, ["часа", "часов", "часов"])}${roundsHint(value * ROUNDS_PER_HOUR)}`;
    default:
      return "особая длительность";
  }
}

function concentrationCheckDc(damage: number): number {
  if (!Number.isInteger(damage) || damage < 0) {
    throw new DomainError(`Полученный урон должен быть целым неотрицательным, получено: ${damage}`);
  }
  return Math.max(MINIMUM_CONCENTRATION_DC, Math.floor(damage / 2));
}

type ConcentrationCheck = {
  /** Спасбросок Телосложения — единственный вид проверки концентрации. */
  ability: "CON";
  dc: number;
  modifier: number;
  hasAdvantage: boolean;
  /** Наименьший результат d20, который проходит проверку. */
  minimumRoll: number;
};

/** Грани d20: спасбросок автоматических успехов и провалов по правилам 2014 не знает. */
const D20_FACES = 20;

/**
 * Каким броском проверка решается: любым, никаким или начиная с определённого.
 *
 * Границы принадлежат правилу, а не подписи: натуральная 20 спасбросок не проходит сама по себе,
 * и «не проходит даже 20» — вывод из этого, а не из вёрстки.
 */
type CheckOutcome = "any_roll" | "impossible" | "threshold";

export function checkOutcome(check: ConcentrationCheck): CheckOutcome {
  if (check.minimumRoll <= 1) return "any_roll";
  if (check.minimumRoll > D20_FACES) return "impossible";
  return "threshold";
}

export function describeConcentrationCheck(
  damage: number,
  constitutionSaveModifier: number,
  options: { hasAdvantage?: boolean } = {},
): ConcentrationCheck {
  if (!Number.isInteger(constitutionSaveModifier)) {
    throw new DomainError(
      `Модификатор спасброска должен быть целым, получено: ${constitutionSaveModifier}`,
    );
  }
  const dc = concentrationCheckDc(damage);
  return {
    ability: "CON",
    dc,
    modifier: constitutionSaveModifier,
    hasAdvantage: options.hasAdvantage === true,
    minimumRoll: dc - constitutionSaveModifier,
  };
}
