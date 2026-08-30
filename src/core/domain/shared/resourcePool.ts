import { DomainError } from "./errors";

type ResourcePoolState = {
  maximum: number;
  remaining: number;
};

const NO_DEBT = 0;

const ANY_DEBT = Number.NEGATIVE_INFINITY;

export class ResourcePool {
  private constructor(
    readonly maximum: number,
    readonly remaining: number,
  ) {}

  static from(state: ResourcePoolState, nameRu: string): ResourcePool {
    return ResourcePool.read(state, nameRu, NO_DEBT);
  }

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

  resized(maximum: number): ResourcePool {
    const shifted = this.remaining + (maximum - this.maximum);
    const standingDebt = Math.min(NO_DEBT, this.remaining);
    return new ResourcePool(maximum, Math.min(Math.max(standingDebt, shifted), maximum));
  }

  restored(): ResourcePool {
    return new ResourcePool(this.maximum, this.maximum);
  }

  toState(): ResourcePoolState {
    return { maximum: this.maximum, remaining: this.remaining };
  }
}
