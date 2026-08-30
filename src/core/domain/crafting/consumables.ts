const MINUTES_PER_HOUR = 60;

export type Consumables = { readonly nameRu: string; readonly goldPerStartedHour: number };

export function consumablesOf(difficulty: number): Consumables {
  if (difficulty <= 19) return { nameRu: "Обычные", goldPerStartedHour: 1 };
  if (difficulty <= 29) return { nameRu: "Очищенные", goldPerStartedHour: 3 };
  if (difficulty <= 39) return { nameRu: "Высокоточные", goldPerStartedHour: 10 };
  return { nameRu: "Экзотические", goldPerStartedHour: 30 };
}

export function startedHours(minutes: number): number {
  return Math.ceil(minutes / MINUTES_PER_HOUR);
}
