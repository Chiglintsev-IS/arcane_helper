/**
 * Редкость свойства называет стол: вывести её приложению не из чего. Одна и та же редкость стоит
 * по-разному в зависимости от роли свойства в замысле — ради него варят, оно досталось попутно или
 * его гасят, — и она же надбавляется к сложности исследования.
 */
export const RARITY_MODIFIERS = {
  "Обычное": { main: 0, additional: 2, suppression: 2, research: 0 },
  "Необычное": { main: 2, additional: 3, suppression: 3, research: 1 },
  "Редкое": { main: 5, additional: 5, suppression: 4, research: 2 },
  "Очень редкое": { main: 8, additional: 7, suppression: 6, research: 4 },
  "Легендарное": { main: 12, additional: 10, suppression: 8, research: 7 },
} as const;

export type RarityRu = keyof typeof RARITY_MODIFIERS;

export type RarityStep = (typeof RARITY_MODIFIERS)[RarityRu] & { readonly nameRu: string };

/**
 * Редкость попутного свойства стол не называет — спрашивают про то, ради чего варят. Поэтому
 * оставшиеся сверх основного оцениваются по обычной редкости: это первая строка той же таблицы.
 */
export const PLAINEST_RARITY: RarityRu = "Обычное";

/** Редкости перечнем: та же таблица, по которой считается цена свойства и надбавка исследования. */
export function rarities(): readonly RarityStep[] {
  return Object.entries(RARITY_MODIFIERS).map(([nameRu, step]) => ({ nameRu, ...step }));
}
