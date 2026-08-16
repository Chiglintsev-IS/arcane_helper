/**
 * Алхимические расходники: класс по итоговой сложности и цена комплекта за начатый час.
 *
 * Своим модулем, а не внутри партии: та же таблица оплачивает и изготовление, и исследование
 * свойства, и второй её экземпляр разошёлся бы с первым при первой же правке справочника — молча и
 * в ту сторону, где работа кажется дешевле, чем есть.
 */

const MINUTES_PER_HOUR = 60;

export type Consumables = { readonly nameRu: string; readonly goldPerStartedHour: number };

/** Класс расходников по итоговой сложности и цена его комплекта за начатый час. */
export function consumablesOf(difficulty: number): Consumables {
  if (difficulty <= 19) return { nameRu: "Обычные", goldPerStartedHour: 1 };
  if (difficulty <= 29) return { nameRu: "Очищенные", goldPerStartedHour: 3 };
  if (difficulty <= 39) return { nameRu: "Высокоточные", goldPerStartedHour: 10 };
  return { nameRu: "Экзотические", goldPerStartedHour: 30 };
}

/** Начатые часы: комплект расходников берут и за неполный час тоже. */
export function startedHours(minutes: number): number {
  return Math.ceil(minutes / MINUTES_PER_HOUR);
}
