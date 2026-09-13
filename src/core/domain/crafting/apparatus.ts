export const RELIABLE_FIELD_KIT = "Надёжный походный комплект";

export const APPARATUS_GRADES = [
  "Обычный походный комплект",
  RELIABLE_FIELD_KIT,
  "Профессиональный походный комплект",
  "Мастерский походный комплект",
  "Базовый лабораторный модуль",
  "Оснащённый лабораторный модуль",
  "Профессиональный лабораторный модуль",
  "Мастерский лабораторный модуль",
  "Великий лабораторный модуль",
] as const;

type ApparatusGrade = (typeof APPARATUS_GRADES)[number];

type ApparatusLimits = {
  readonly hardest: number;
  readonly batch: number;
  readonly stationary: boolean;
};

const APPARATUS_LIMITS = {
  "Обычный походный комплект": { hardest: 15, batch: 3, stationary: false },
  [RELIABLE_FIELD_KIT]: { hardest: 20, batch: 6, stationary: false },
  "Профессиональный походный комплект": { hardest: 25, batch: 10, stationary: false },
  "Мастерский походный комплект": { hardest: 30, batch: 15, stationary: false },
  "Базовый лабораторный модуль": { hardest: 20, batch: 10, stationary: true },
  "Оснащённый лабораторный модуль": { hardest: 25, batch: 20, stationary: true },
  "Профессиональный лабораторный модуль": { hardest: 30, batch: 40, stationary: true },
  "Мастерский лабораторный модуль": { hardest: 35, batch: 80, stationary: true },
  "Великий лабораторный модуль": { hardest: 45, batch: 150, stationary: true },
} as const satisfies Record<ApparatusGrade, ApparatusLimits>;

/** Набор один на всю алхимию: направления делят его, как делят стол алхимика. */
export type Apparatus = ApparatusGrade | undefined;

const IMPROVISED_RU = "Импровизированные сосуды";

const IMPROVISED_LIMITS = { hardest: 15, batch: 1, stationary: false } as const;

const IMPROVISED_DIFFICULTY = 5;

export type ApparatusEntry = ApparatusLimits & {
  readonly nameRu: string;
  readonly surcharge: number;
};

/** Оснащение перечнем: работа без набора — такая же его строка, со своей надбавкой к сложности. */
export function apparatusEntries(): readonly ApparatusEntry[] {
  return [
    ...APPARATUS_GRADES.map((grade) => ({
      nameRu: grade,
      ...APPARATUS_LIMITS[grade],
      surcharge: improvisedDifficulty(grade),
    })),
    { nameRu: IMPROVISED_RU, ...IMPROVISED_LIMITS, surcharge: improvisedDifficulty(undefined) },
  ];
}

export function hardestPossible(): number {
  return apparatusEntries().reduce((hardest, one) => Math.max(hardest, one.hardest), 0);
}

function apparatusOf(apparatus: Apparatus): ApparatusLimits | undefined {
  return apparatus === undefined ? undefined : APPARATUS_LIMITS[apparatus];
}

export function apparatusLimits(apparatus: Apparatus): ApparatusLimits {
  return apparatusOf(apparatus) ?? IMPROVISED_LIMITS;
}

export function improvisedDifficulty(apparatus: Apparatus): number {
  return apparatus === undefined ? IMPROVISED_DIFFICULTY : 0;
}

function stronger(grade: ApparatusGrade, than: ApparatusGrade): boolean {
  const one = APPARATUS_LIMITS[grade];
  const other = APPARATUS_LIMITS[than];
  return one.hardest === other.hardest ? one.batch > other.batch : one.hardest > other.hardest;
}

function isApparatusGrade(grade: unknown): grade is ApparatusGrade {
  return APPARATUS_GRADES.some((known) => known === grade);
}

export function strongestApparatus(grades: readonly unknown[]): Apparatus {
  return grades
    .filter(isApparatusGrade)
    .reduce<Apparatus>(
      (best, grade) => (best === undefined || stronger(grade, best) ? grade : best),
      undefined,
    );
}
