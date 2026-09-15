import { RARITY_NAMES } from "@/core/domain/shared/rarity";
import type { RarityRu } from "@/core/domain/shared/rarity";

/**
 * Чего стоит редкость. Одна и та же редкость платится по-разному в зависимости от роли свойства в
 * замысле — ради него варят, оно досталось попутно или его гасят, — и она же надбавляется к
 * сложности исследования. Слова редкости принадлежат общему словарю, цены по ним — ремеслу.
 */
const RARITY_MODIFIERS = {
  "Обычное": { main: 0, additional: 2, suppression: 2, research: 0 },
  "Необычное": { main: 2, additional: 3, suppression: 3, research: 1 },
  "Редкое": { main: 5, additional: 5, suppression: 4, research: 2 },
  "Очень редкое": { main: 8, additional: 7, suppression: 6, research: 4 },
  "Легендарное": { main: 12, additional: 10, suppression: 8, research: 7 },
} as const satisfies Record<RarityRu, Record<string, number>>;

export type RarityStep = (typeof RARITY_MODIFIERS)[RarityRu] & { readonly nameRu: string };

export function rarityCost(rarityRu: RarityRu): (typeof RARITY_MODIFIERS)[RarityRu] {
  return RARITY_MODIFIERS[rarityRu];
}

/** Редкости перечнем: та же таблица, по которой считается цена свойства и надбавка исследования. */
export function rarities(): readonly RarityStep[] {
  return RARITY_NAMES.map((nameRu) => ({ nameRu, ...RARITY_MODIFIERS[nameRu] }));
}
