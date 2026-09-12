/**
 * Слова алхимии, которые произносят оба слайса: и запись о вещи, и верстак. Общее место у них
 * ниже слоя, потому что слайсы одного слоя друг о друге не знают.
 */
export function labelled(labels: Readonly<Record<string, string>>, code: string): string {
  return labels[code] ?? code;
}

export function propertyNumberRu(number: number): string {
  return `${number}-е`;
}

export const NOTHING_REVEALED = "Ничего не раскрыто";
