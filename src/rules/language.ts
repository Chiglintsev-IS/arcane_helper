/**
 * Русская морфология для текстов, которые приложение собирает само.
 *
 * Живёт рядом с движком правил, потому что фразы с числами строят и правила («2 очка заклинаний»),
 * и интерфейс («3 раунда»). Одна реализация вместо двух: «2 очков» за столом читается как ошибка
 * приложения, а значит и как повод сомневаться в его числах.
 */

/** Форма слова при числе: 1 очко, 2 очка, 5 очков. */
export function plural(count: number, forms: [string, string, string]): string {
  const remainder100 = Math.abs(count) % 100;
  const remainder10 = remainder100 % 10;
  if (remainder100 > 10 && remainder100 < 20) return forms[2];
  if (remainder10 > 1 && remainder10 < 5) return forms[1];
  if (remainder10 === 1) return forms[0];
  return forms[2];
}

/** Число вместе со словом: `withPlural(2, ["очко", "очка", "очков"])` → «2 очка». */
export function withPlural(count: number, forms: [string, string, string]): string {
  return `${count} ${plural(count, forms)}`;
}

/**
 * Названия характеристик в родительном падеже: «спасбросок Телосложения».
 *
 * Здесь, а не в двух местах: объявление мастеру и блок концентрации называют один и тот же
 * спасбросок, и разойтись в слове они не должны. Сокращений нет — правила интерфейса разрешают
 * только «КС» и «КД» (ux.md#текст-в-интерфейсе).
 */
export const SAVING_THROW_NAMES = {
  STR: "Силы",
  DEX: "Ловкости",
  CON: "Телосложения",
  INT: "Интеллекта",
  WIS: "Мудрости",
  CHA: "Харизмы",
} as const;

/** Единица долгого накладывания: минуты или часы ([FR-033](../../docs/features/F-03-cast-wizard.md#fr-033)). */
export type LongCastingUnit = "minute" | "hour";

const LONG_CASTING_FORMS: Record<LongCastingUnit, [string, string, string]> = {
  minute: ["минута", "минуты", "минут"],
  hour: ["час", "часа", "часов"],
};

/**
 * Время накладывания дольше хода словами: «1 минута», «10 минут», «1 час».
 *
 * Здесь, а не в подписях интерфейса, потому что это же время называет и проверка доступности:
 * две реализации разошлись бы в падеже или в числе.
 */
export function longCastingTimeRu(unit: LongCastingUnit, value: number): string {
  return withPlural(value, LONG_CASTING_FORMS[unit]);
}
