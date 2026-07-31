/**
 * Кровавое колдовство и расовые особенности лунного тролля.
 *
 * Реализует FR-170…FR-176 и FR-180…FR-184. Все числа взяты из документа расы игрока и перенесены в
 * docs/rules-engine.md#раса-лунный-тролль. Раса самодельная, поэтому значения ждут подтверждения
 * мастером — OQ-15. Менять их следует здесь и в спеке одновременно.
 */

import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL, RulesError } from "./abilities";

/** Ступени возвышения: сколько хитов отдаётся за одно очко заклинаний. */
const ASCENSION_TIERS: readonly { readonly upToLevel: number; readonly hitPointsPerPoint: number }[] = [
  { upToLevel: 4, hitPointsPerPoint: 2 },
  { upToLevel: 8, hitPointsPerPoint: 3 },
  { upToLevel: 12, hitPointsPerPoint: 4 },
  { upToLevel: 16, hitPointsPerPoint: 5 },
  { upToLevel: 20, hitPointsPerPoint: 6 },
];

/** Стоимость сотворения в очках заклинаний по уровню заклинания. */
const SPELL_POINT_COSTS: Readonly<Record<number, number>> = { 1: 2, 2: 3, 3: 5, 4: 6, 5: 7 };

/** Раны за обмен, опустивший здоровье до нуля: одна за сам факт и по одной за каждые три очка. */
const WOUNDS_PER_POINTS = 3;

function assertLevel(level: number): void {
  if (
    !Number.isInteger(level) ||
    level < MINIMUM_CHARACTER_LEVEL ||
    level > MAXIMUM_CHARACTER_LEVEL
  ) {
    throw new RulesError(`Уровень персонажа вне допустимого диапазона: ${level}`);
  }
}

/**
 * Курс обмена на данном уровне. Для Торна (7 уровень) — 3 хита за очко.
 *
 * Поиск ступени служит и проверкой уровня: нецелый, нулевой и запредельный уровень
 * не попадают ни в одну ступень.
 */
export function ascensionTierRate(level: number): number {
  const tier =
    Number.isInteger(level) && level >= MINIMUM_CHARACTER_LEVEL
      ? ASCENSION_TIERS.find((candidate) => level <= candidate.upToLevel)
      : undefined;
  if (tier === undefined) {
    throw new RulesError(`Уровень персонажа вне допустимого диапазона: ${level}`);
  }
  return tier.hitPointsPerPoint;
}

/** Максимальный уровень заклинания, который вообще оплачивается очками. */
export const MAXIMUM_PAYABLE_SPELL_LEVEL = 5;

/** Стоимость заклинания в очках заклинаний. */
export function spellPointCost(spellLevel: number): number {
  const cost = SPELL_POINT_COSTS[spellLevel];
  if (cost === undefined) {
    throw new RulesError(
      `Очками заклинаний оплачиваются только уровни 1…${MAXIMUM_PAYABLE_SPELL_LEVEL}, получено: ${spellLevel}`,
    );
  }
  return cost;
}

/** Стоимость заклинания в хитах: очки, умноженные на курс ступени. */
export function hitPointCost(spellLevel: number, level: number): number {
  return spellPointCost(spellLevel) * ascensionTierRate(level);
}

export type Exchange = {
  /** Сколько хитов будет потрачено — без остатка, не давшего очка. */
  hitPointsSpent: number;
  pointsCreated: number;
  /** Остаток хитов, который не хватило до следующего очка: он не тратится. */
  remainderIgnored: number;
};

/**
 * Обмен хитов на очки: даёт только целые очки, остаток не расходуется.
 * 10 хитов при курсе 3 дают 3 очка и оставляют 1 хит нетронутым.
 */
export function exchangeHitPoints(hitPoints: number, level: number): Exchange {
  if (!Number.isInteger(hitPoints) || hitPoints < 0) {
    throw new RulesError(`Количество хитов должно быть целым неотрицательным, получено: ${hitPoints}`);
  }
  const rate = ascensionTierRate(level);
  const pointsCreated = Math.floor(hitPoints / rate);
  return {
    hitPointsSpent: pointsCreated * rate,
    pointsCreated,
    remainderIgnored: hitPoints - pointsCreated * rate,
  };
}

/** Обмен, достаточный для заклинания указанного уровня. */
export function exchangeForSpellLevel(spellLevel: number, level: number): Exchange {
  const hitPoints = hitPointCost(spellLevel, level);
  return exchangeHitPoints(hitPoints, level);
}

/** Раны за обмен, опустивший здоровье до нуля. */
export function woundsFromExchange(pointsCreated: number): number {
  if (!Number.isInteger(pointsCreated) || pointsCreated < 0) {
    throw new RulesError(`Число очков должно быть целым неотрицательным, получено: ${pointsCreated}`);
  }
  return 1 + Math.floor(pointsCreated / WOUNDS_PER_POINTS);
}

/** Восстановление хитов регенерацией за один свой ход. Для 7 уровня — 3. */
export function regenerationPerTurn(level: number): number {
  assertLevel(level);
  return 1 + Math.floor(level / 3);
}

/** Восстановление снижённого максимума за один полный час. Для 7 уровня — 3. */
export function maximumRecoveryPerHour(level: number): number {
  return regenerationPerTurn(level);
}

export type SuppressionState = {
  /** Урон огнём получен: особенности не работают до конца следующего хода. */
  firedUpon: boolean;
  underDirectSunlight: boolean;
};

/** Работают ли расовые особенности прямо сейчас. */
export function traitsSuppressed(state: SuppressionState): boolean {
  return state.firedUpon || state.underDirectSunlight;
}

export type HitPointState = {
  current: number;
  /** Максимум уже с учётом снижения от кровавого колдовства. */
  maximum: number;
};

/**
 * Действует ли регенерация в начале хода: есть хиты, здоровье ниже половины максимума,
 * нет подавления. Порог считается от снижённого максимума, а не от исходного.
 */
export function regenerationApplies(
  hitPoints: HitPointState,
  suppression: SuppressionState,
): boolean {
  if (traitsSuppressed(suppression)) return false;
  if (hitPoints.current <= 0) return false;
  return hitPoints.current < hitPoints.maximum / 2;
}

/** Доступно ли кровавое колдовство: те же условия подавления. */
export function bloodMagicAvailable(suppression: SuppressionState): boolean {
  return !traitsSuppressed(suppression);
}

/**
 * Снижение максимума хитов после обмена: ровно на потраченные хиты.
 * Лечением и регенерацией не устраняется.
 */
export function applyExchangeToHitPoints(
  hitPoints: HitPointState,
  exchange: Exchange,
): HitPointState {
  return {
    current: hitPoints.current - exchange.hitPointsSpent,
    maximum: hitPoints.maximum - exchange.hitPointsSpent,
  };
}

/** КС почасового спасброска под солнцем. Вне MVP, формула сохранена — FR-184. */
export function sunSaveDc(savesMadeToday: number): number {
  if (!Number.isInteger(savesMadeToday) || savesMadeToday < 0) {
    throw new RulesError(
      `Число совершённых спасбросков должно быть целым неотрицательным, получено: ${savesMadeToday}`,
    );
  }
  return 10 + 2 * savesMadeToday;
}
