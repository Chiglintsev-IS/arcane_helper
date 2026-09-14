export function plural(count: number, forms: [string, string, string]): string {
  const remainder100 = Math.abs(count) % 100;
  const remainder10 = remainder100 % 10;
  if (remainder100 > 10 && remainder100 < 20) return forms[2];
  if (remainder10 > 1 && remainder10 < 5) return forms[1];
  if (remainder10 === 1) return forms[0];
  return forms[2];
}

export function withPlural(count: number, forms: [string, string, string]): string {
  return `${count} ${plural(count, forms)}`;
}

export function signed(value: number): string {
  return value < 0 ? `−${Math.abs(value)}` : `+${value}`;
}

export const SAVING_THROW_NAMES = {
  STR: "Силы",
  DEX: "Ловкости",
  CON: "Телосложения",
  INT: "Интеллекта",
  WIS: "Мудрости",
  CHA: "Харизмы",
} as const;

export const SAVING_THROW_SHORT = {
  STR: "СИЛ",
  DEX: "ЛОВ",
  CON: "ТЕЛ",
  INT: "ИНТ",
  WIS: "МДР",
  CHA: "ХАР",
} as const;

export const CURRENCY_ABBREVIATIONS = {
  gold: "зм",
  silver: "см",
  copper: "мм",
} as const;

/** Цена сокращением монеты: таблица сокращений одна, и разбирать её на месте не приходится. */
export function coinRu(amount: number, currency: string): string {
  const found = Object.entries(CURRENCY_ABBREVIATIONS).find(([name]) => name === currency);
  return found === undefined ? String(amount) : `${amount} ${found[1]}`;
}

/** Полное имя монеты: его называют там, где цена стоит своей строкой и сокращать её незачем. */
const GOLD_FORMS: [string, string, string] = ["золотой", "золотых", "золотых"];

export function goldRu(amount: number): string {
  return withPlural(amount, GOLD_FORMS);
}

export const AREA_SHAPES_RU = {
  cone: "Конус",
  cube: "Куб",
  line: "Линия",
  sphere: "Сфера",
  cylinder: "Цилиндр",
} as const;

export const NO_ROLL_RU = "Без броска";

export const CHECK_DIE_RU = "d20";

export const MISHAP_DIE_RU = "d6";

export type TimeSpanUnit = "minute" | "hour";

const TIME_SPAN_FORMS: Record<TimeSpanUnit, [string, string, string]> = {
  minute: ["минута", "минуты", "минут"],
  hour: ["час", "часа", "часов"],
};

export function timeSpanRu(unit: TimeSpanUnit, value: number): string {
  return withPlural(value, TIME_SPAN_FORMS[unit]);
}

export type TimeUnit = "round" | "minute" | "hour";

const TIME_FORMS_ACCUSATIVE: Record<TimeUnit, [string, string, string]> = {
  round: ["раунд", "раунда", "раундов"],
  minute: ["минуту", "минуты", "минут"],
  hour: ["час", "часа", "часов"],
};

export const ROUNDS_PER_MINUTE = 10;

export function timeSpanAccusativeRu(unit: TimeUnit, value: number): string {
  return withPlural(value, TIME_FORMS_ACCUSATIVE[unit]);
}
