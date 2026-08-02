import type { ConcentrationCheck } from "@/core/domain/effects/concentration";

/** Натуральная 20 спасбросок не проходит, поэтому непроходимая проверка так и называется. */
export function checkGuidanceRu(check: ConcentrationCheck): string {
  if (check.minimumRoll <= 1) return "Проходит любой бросок d20";
  if (check.minimumRoll > 20) return "Не проходит даже 20: концентрация держится только руной";
  const dice = check.hasAdvantage ? "d20 с преимуществом" : "d20";
  return `Бросьте ${dice}, нужно ${check.minimumRoll} и выше`;
}
