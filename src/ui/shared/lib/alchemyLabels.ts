/**
 * Слова алхимии, которые произносят оба слайса: и запись о вещи, и верстак. Общее место у них
 * ниже слоя, потому что слайсы одного слоя друг о друге не знают.
 */
export const RARITY_LABELS: Readonly<Record<string, string>> = {
  common: "обычное",
  uncommon: "необычное",
  rare: "редкое",
  veryRare: "очень редкое",
  legendary: "легендарное",
};

export const RARITY_UNNAMED = "редкость не названа";

export function labelled(labels: Readonly<Record<string, string>>, code: string): string {
  return labels[code] ?? code;
}

export function rarityLabel(rarity: string | undefined): string {
  return rarity === undefined ? RARITY_UNNAMED : labelled(RARITY_LABELS, rarity);
}

export function propertyNumberRu(number: number): string {
  return `${number}-е`;
}
