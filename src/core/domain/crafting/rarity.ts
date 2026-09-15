import { RARITY_NAMES } from "@/core/domain/shared/rarity";
import type { RarityRu, RarityStepRu } from "@/core/domain/shared/rarity";

/**
 * Чего стоит редкость. Одна и та же редкость платится по-разному в зависимости от роли свойства в
 * замысле — ради него варят, оно досталось попутно или его гасят, — и она же надбавляется к
 * сложности исследования. Слова редкости принадлежат общему словарю, цены по ним — ремеслу.
 *
 * Таблица покрывает лестницу целиком и только её: редкость, названную мимо лестницы, ремесло не
 * оценивает — цену ей называет стол.
 */
const RARITY_MODIFIERS = {
  "Обычное": { main: 0, additional: 2, suppression: 2, research: 0 },
  "Необычное": { main: 2, additional: 3, suppression: 3, research: 1 },
  "Редкое": { main: 5, additional: 5, suppression: 4, research: 2 },
  "Очень редкое": { main: 8, additional: 7, suppression: 6, research: 4 },
  "Легендарное": { main: 12, additional: 10, suppression: 8, research: 7 },
} as const satisfies Record<RarityStepRu, Record<string, number>>;

type RarityCost = (typeof RARITY_MODIFIERS)[RarityStepRu];

/** Строка справочника числами: у редкости вне лестницы каждое число называет стол. */
export type RarityStep = {
  readonly nameRu: string;
  readonly main: number | null;
  readonly additional: number | null;
  readonly suppression: number | null;
  readonly research: number | null;
};

const UNPRICED: Omit<RarityStep, "nameRu"> = {
  main: null,
  additional: null,
  suppression: null,
  research: null,
};

export function rarityCost(rarityRu: RarityStepRu): RarityCost {
  return RARITY_MODIFIERS[rarityRu];
}

const PRICED: ReadonlyMap<string, RarityCost> = new Map(Object.entries(RARITY_MODIFIERS));

/** Строка таблицы по слову редкости: за особой её нет, и пустота здесь — ответ, а не пробел. */
export function rarityRow(rarityRu: RarityRu): RarityCost | null {
  return PRICED.get(rarityRu) ?? null;
}

/**
 * Редкости перечнем: та же таблица, по которой считается цена свойства и надбавка исследования.
 * Особая стоит в нём наравне с лестницей — без неё пометить ею замысел было бы не из чего, — и
 * чисел не называет.
 */
export function rarities(): readonly RarityStep[] {
  return RARITY_NAMES.map((nameRu) => ({ nameRu, ...UNPRICED, ...(rarityRow(nameRu) ?? {}) }));
}
