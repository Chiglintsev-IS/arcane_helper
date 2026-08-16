/**
 * Подписи к словам ремесла: ступени редкости, ступени усиления и направления алхимии.
 *
 * Домен отдаёт слово правил, подпись к нему выбирает отображение — и выбирает один раз: одно и то
 * же «редкое» читают и строка знания, и совпавшее свойство на верстаке.
 */

/** Ступени редкости словами. */
export const RARITY_LABELS: Readonly<Record<string, string>> = {
  common: "обычное",
  uncommon: "необычное",
  rare: "редкое",
  veryRare: "очень редкое",
  legendary: "легендарное",
};

/** Ступени усиления словами: сколько разных источников — столько и силы. */
export const TIER_LABELS: Readonly<Record<string, string>> = {
  plain: "обычная",
  amplified: "усиленная",
  concentrated: "концентрированная",
};

/** Направления алхимии словами. */
export const DIRECTION_LABELS: Readonly<Record<string, string>> = {
  potions: "зельеварение",
  poisons: "синтез ядов",
  transmutation: "трансмутация",
};

/** Номер свойства ординалом: он говорит, насколько глубоко оно было скрыто, а не сколько его. */
export function propertyNumberRu(number: number): string {
  return `${number}-е`;
}

/** Слово по коду, а незнакомый код — сам собой: выдумывать перевод отображению не из чего. */
export function labelled(labels: Readonly<Record<string, string>>, code: string): string {
  return labels[code] ?? code;
}
