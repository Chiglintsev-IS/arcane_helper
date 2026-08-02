/**
 * Пул расходуемого ресурса: сколько всего и сколько осталось.
 *
 * Один объект-значение на руны, Кости хитов и любой будущий счётчик. До него у каждого ресурса была
 * своя копия одного и того же правила и своя копия «прибавить-убавить с проверкой границ»; правило
 * жило в четырёх местах и в четырёх местах могло разойтись.
 */

import { DomainError } from "./errors";

export type ResourcePoolState = {
  maximum: number;
  remaining: number;
};

export class ResourcePool {
  private constructor(
    readonly maximum: number,
    readonly remaining: number,
  ) {}

  /** Пул из хранимого состояния. Нарушение границ здесь — испорченные данные, а не ход игры. */
  static from(state: ResourcePoolState, nameRu: string): ResourcePool {
    if (state.remaining < 0 || state.remaining > state.maximum) {
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

  /** Полное восстановление: долгий отдых возвращает пул целиком. */
  restored(): ResourcePool {
    return new ResourcePool(this.maximum, this.maximum);
  }

  toState(): ResourcePoolState {
    return { maximum: this.maximum, remaining: this.remaining };
  }
}
