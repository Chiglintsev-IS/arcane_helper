/**
 * Пул расходуемого ресурса: сколько всего и сколько осталось.
 *
 * Один объект-значение на руны, Кости хитов и любой будущий счётчик. До него у каждого ресурса была
 * своя копия одного и того же правила и своя копия «прибавить-убавить с проверкой границ»; правило
 * жило в четырёх местах и в четырёх местах могло разойтись.
 */

import { DomainError } from "./errors";

type ResourcePoolState = {
  maximum: number;
  remaining: number;
};

/** Ниже нуля остаток не уходит: перерасход разрешает владелец ресурса, а не арифметика. */
const NO_DEBT = 0;

/** Разрешённому долгу предела нет: сколько мастер позволил истратить, столько и висит. */
const ANY_DEBT = Number.NEGATIVE_INFINITY;

export class ResourcePool {
  private constructor(
    readonly maximum: number,
    readonly remaining: number,
  ) {}

  /** Пул из хранимого состояния. Нарушение границ здесь — испорченные данные, а не ход игры. */
  static from(state: ResourcePoolState, nameRu: string): ResourcePool {
    return ResourcePool.read(state, nameRu, NO_DEBT);
  }

  /**
   * Пул ресурса, перерасход которого вправе разрешить мастер: остаток ниже нуля — долг, объявленный
   * владельцем ресурса, а не испорченные данные. Остаток выше максимума долгом не бывает и здесь.
   */
  static overdraftable(state: ResourcePoolState, nameRu: string): ResourcePool {
    return ResourcePool.read(state, nameRu, ANY_DEBT);
  }

  private static read(state: ResourcePoolState, nameRu: string, debtFloor: number): ResourcePool {
    if (state.remaining < debtFloor || state.remaining > state.maximum) {
      throw new DomainError(
        `${nameRu}: осталось ${state.remaining} при максимуме ${state.maximum}`,
      );
    }
    return new ResourcePool(state.maximum, state.remaining);
  }

  get depleted(): boolean {
    return this.remaining <= 0;
  }

  /** Изменение остатка на дельту. Выход за границы — отказ с причиной, а не молчаливое усечение. */
  shift(delta: number, nameRu: string): ResourcePool {
    const remaining = this.remaining + delta;
    if (remaining < 0 || remaining > this.maximum) {
      throw new DomainError(
        `${nameRu} может быть от 0 до ${this.maximum}, получилось ${remaining}`,
      );
    }
    return new ResourcePool(this.maximum, remaining);
  }

  spend(nameRu: string, count = 1): ResourcePool {
    return this.shift(-count, nameRu);
  }

  /**
   * Новый максимум: остаток движется на ту же разницу.
   *
   * Правило одно на ячейки, руны и Кости хитов: взятый уровень отдаёт новую ячейку неистраченной, а
   * потерянный забирает её, не трогая уже потраченное. Стоящий долг — тоже потраченное: смена
   * максимума его не прощает и не углубляет, а выросший максимум его гасит.
   */
  resized(maximum: number): ResourcePool {
    const shifted = this.remaining + (maximum - this.maximum);
    const standingDebt = Math.min(NO_DEBT, this.remaining);
    return new ResourcePool(maximum, Math.min(Math.max(standingDebt, shifted), maximum));
  }

  /** Полное восстановление: долгий отдых возвращает пул целиком. */
  restored(): ResourcePool {
    return new ResourcePool(this.maximum, this.maximum);
  }

  toState(): ResourcePoolState {
    return { maximum: this.maximum, remaining: this.remaining };
  }
}
