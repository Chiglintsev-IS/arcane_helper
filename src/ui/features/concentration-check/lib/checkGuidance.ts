import { checkOutcome, type ConcentrationCheck } from "@/core/domain/effects/concentration";
import { CHECK_DIE_RU } from "@/core/shared/language";

/** Подпись к проверке: вердикт приходит из правила, здесь остаётся выбор слов. */
export function checkGuidanceRu(check: ConcentrationCheck): string {
  switch (checkOutcome(check)) {
    case "any_roll":
      return `Проходит любой бросок ${CHECK_DIE_RU}`;
    case "impossible":
      return "Не проходит даже 20: концентрация держится только руной";
    case "threshold": {
      const dice = check.hasAdvantage ? `${CHECK_DIE_RU} с преимуществом` : CHECK_DIE_RU;
      return `Бросьте ${dice}, нужно ${check.minimumRoll} и выше`;
    }
  }
}
