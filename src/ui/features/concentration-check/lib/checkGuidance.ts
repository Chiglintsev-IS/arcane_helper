import { checkOutcome, type ConcentrationCheck } from "@/core/domain/effects/concentration";

/** Подпись к проверке: вердикт приходит из правила, здесь остаётся выбор слов. */
export function checkGuidanceRu(check: ConcentrationCheck): string {
  switch (checkOutcome(check)) {
    case "any_roll":
      return "Проходит любой бросок d20";
    case "impossible":
      return "Не проходит даже 20: концентрация держится только руной";
    case "threshold": {
      const dice = check.hasAdvantage ? "d20 с преимуществом" : "d20";
      return `Бросьте ${dice}, нужно ${check.minimumRoll} и выше`;
    }
  }
}
