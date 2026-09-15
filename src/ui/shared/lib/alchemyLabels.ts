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

/**
 * Сложность исследования называется базовой: редкость свойства мастер добавит к ней сам, и заранее
 * она неизвестна. Об этом говорят оба места, где число стоит, — и говорят одними словами.
 */
export const BASE_DIFFICULTY_LABEL = "БАЗОВАЯ СЛ";
export const RARITY_NOTE = "+ редкость свойства";

/** Номера идут подряд: очередное свойство ремесло называет само, выбирать игроку не из чего. */
export function revealTitleRu(number: number): string {
  return `Раскрыть ${propertyNumberRu(number)} свойство`;
}

/**
 * Слова справки о виде: их называют и книга алхимика, где справку дописывают, и карточка вещи, где
 * её читают. Место у слов одно, иначе два экрана назвали бы одно поле по-разному.
 */
export const INGREDIENT_RECORD_NAMES = {
  find: "СЛ поиска",
  gather: "СЛ сбора",
  yield: "Выход с источника",
  portion: "Что такое порция",
} as const;
