const MINUTES_PER_HOUR = 60;

export type Consumables = { readonly nameRu: string; readonly goldPerStartedHour: number };

const CONSUMABLE_CLASSES = [
  { nameRu: "Обычные", untilDifficulty: 19, goldPerStartedHour: 1 },
  { nameRu: "Очищенные", untilDifficulty: 29, goldPerStartedHour: 3 },
  { nameRu: "Высокоточные", untilDifficulty: 39, goldPerStartedHour: 10 },
] as const;

/** Верхней границы у последнего класса нет: сложность растёт, а дороже этого расходников не бывает. */
const HARDEST_CLASS: Consumables = { nameRu: "Экзотические", goldPerStartedHour: 30 };

export function consumablesOf(difficulty: number): Consumables {
  const found = CONSUMABLE_CLASSES.find((one) => difficulty <= one.untilDifficulty);
  return found === undefined
    ? HARDEST_CLASS
    : { nameRu: found.nameRu, goldPerStartedHour: found.goldPerStartedHour };
}

export type ConsumableBand = Consumables & {
  readonly fromDifficulty: number;
  readonly toDifficulty: number | null;
};

/** Полосы расходников: нижняя граница следующей — там, где кончилась предыдущая. */
export function consumableBands(lowestDifficulty: number): readonly ConsumableBand[] {
  let from = lowestDifficulty;
  const bands = CONSUMABLE_CLASSES.map((one) => {
    const band = {
      nameRu: one.nameRu,
      goldPerStartedHour: one.goldPerStartedHour,
      fromDifficulty: from,
      toDifficulty: one.untilDifficulty,
    };
    from = one.untilDifficulty + 1;
    return band;
  });
  return [...bands, { ...HARDEST_CLASS, fromDifficulty: from, toDifficulty: null }];
}

export function startedHours(minutes: number): number {
  return Math.ceil(minutes / MINUTES_PER_HOUR);
}
