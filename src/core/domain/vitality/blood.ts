/**
 * Кровавое колдовство и расовые особенности лунного тролля.
 *
 * Все числа взяты из документа расы игрока. Раса самодельная, поэтому значения ждут подтверждения
 * мастером. Менять их следует здесь и в спеке одновременно.
 */

import { DomainError } from "@/core/domain/shared/errors";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";
import { withPlural } from "@/shared/language";

/** За сколько единиц цены прибавляется ещё одна рана. */
const WOUNDS_PER_PRICE_UNIT = 3;

function assertLevel(level: number): void {
  if (
    !Number.isInteger(level) ||
    level < MINIMUM_CHARACTER_LEVEL ||
    level > MAXIMUM_CHARACTER_LEVEL
  ) {
    throw new DomainError(`Уровень персонажа вне допустимого диапазона: ${level}`);
  }
}

/** Раны за плату, опустившую здоровье до нуля: одна за факт и по одной за каждые три единицы цены. */
function woundsFromPrice(levelPrice: number): number {
  if (!Number.isInteger(levelPrice) || levelPrice < 0) {
    throw new DomainError(`Цена уровня должна быть целой неотрицательной, получено: ${levelPrice}`);
  }
  return 1 + Math.floor(levelPrice / WOUNDS_PER_PRICE_UNIT);
}

/**
 * Чем грозит плата кровью, опускающая здоровье до нуля.
 *
 * Фраза одна на всех, кто предупреждает: строка списка и мастер применения называют одно и то же
 * одними словами.
 */
export function woundsWarningRu(levelPrice: number): string {
  return (
    "Хиты уйдут в ноль: 1 рана за сам факт и ещё по 1 за каждые три единицы цены —" +
    ` итого ${withPlural(woundsFromPrice(levelPrice), ["рана", "раны", "ран"])}`
  );
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

/** Долгий отдых — восемь часов: столько же почасовых возвратов максимума. */
export const LONG_REST_HOURS = 8;

/**
 * Каким останется снижение максимума после нескольких часов без солнца и огня.
 *
 * Часы считаются тем же почасовым правилом, а не отдельным «отдых всё обнуляет»: за восемь часов
 * Торн возвращает 24 очка, и если он отдал больше, остаток переходит на следующий день. Списать
 * его значило бы вернуть персонажу здоровье, которого правило не даёт.
 */
export function maximumReductionAfterHours(
  reduction: number,
  level: number,
  hours: number,
): number {
  if (!Number.isInteger(reduction) || reduction < 0) {
    throw new DomainError(`Снижение максимума должно быть целым неотрицательным, получено: ${reduction}`);
  }
  if (!Number.isInteger(hours) || hours < 0) {
    throw new DomainError(`Число часов должно быть целым неотрицательным, получено: ${hours}`);
  }
  return Math.max(0, reduction - maximumRecoveryPerHour(level) * hours);
}

/**
 * Срок подавления уроном огнём: до конца следующего хода. Конца хода приложение не отмечает, и срок
 * отмеряют две отметки его начала — первая открывает тот самый следующий ход, вторая стоит за его
 * концом.
 */
export const FIRE_SUPPRESSION_TURN_STARTS = 2;

type SuppressionState = {
  /** Сколько отметок начала хода ещё отмеряют подавление уроном огнём; ноль — срок вышел. */
  firedUponTurnStarts: number;
  underDirectSunlight: boolean;
};

/** Идёт ли ещё срок, начатый уроном огнём. */
export function suppressedByFire(state: SuppressionState): boolean {
  return state.firedUponTurnStarts > 0;
}

/** Работают ли расовые особенности прямо сейчас. */
export function traitsSuppressed(state: SuppressionState): boolean {
  return suppressedByFire(state) || state.underDirectSunlight;
}

/**
 * Почему кровавое колдовство сейчас не действует; `null` — действует.
 *
 * Фраза одна и та же, кто бы ни спрашивал: отказ объекта-значения и предупреждение мастера обязаны
 * звучать одинаково, иначе игрок читает их как два разных запрета.
 */
export function suppressionReason(state: SuppressionState): string | null {
  if (suppressedByFire(state)) {
    return "Кровавое колдовство подавлено уроном огнём до конца следующего хода";
  }
  if (state.underDirectSunlight) {
    return "Кровавое колдовство не действует под прямым солнечным светом";
  }
  return null;
}
