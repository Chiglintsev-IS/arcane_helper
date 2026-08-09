import type { ConcentrationCheckView } from "@/contract/views";
import { CHECK_DIE_RU } from "@/shared/language";

/** Подпись к проверке: вердикт приходит из правила, здесь остаётся выбор слов. */
export function checkGuidanceRu(check: ConcentrationCheckView): string {
  switch (check.outcome) {
    case "any_roll":
      return `Проходит любой бросок ${CHECK_DIE_RU}`;
    case "impossible":
      return "Не проходит даже 20: концентрация держится только руной";
    default: {
      const dice = check.hasAdvantage ? `${CHECK_DIE_RU} с преимуществом` : CHECK_DIE_RU;
      return `Бросьте ${dice}, нужно ${check.minimumRoll} и выше`;
    }
  }
}
