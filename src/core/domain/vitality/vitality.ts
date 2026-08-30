import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import { ResourcePool } from "@/core/domain/shared/resourcePool";
import {
  FIRE_SUPPRESSION_TURN_STARTS,
  maximumRecoveryPerHour,
  regenerationPerTurn,
  suppressedByFire,
  suppressionReason,
  traitsSuppressed,
} from "./blood";
import {
  effectiveMaximum,
  isPossibleHitPointChange,
  isPossibleHitPointMaximum,
  isPossibleReduction,
  type VitalityState,
} from "./schema";

const HIT_DICE_RU = "Костей хитов";

export class Vitality {
  private constructor(private readonly state: VitalityState) {}

  private static readonly KEYS = ["hitPoints", "temporaryHitPoints", "hitDice", "suppression"] as const satisfies readonly (keyof VitalityState)[];

  static of(state: VitalityState): Vitality {
    return new Vitality(ownedFields(state, Vitality.KEYS));
  }

  private with(change: Partial<VitalityState>): Vitality {
    return new Vitality({ ...this.state, ...change });
  }

  get current(): number {
    return this.state.hitPoints.current;
  }

  get maximumBase(): number {
    return this.state.hitPoints.maximumBase;
  }

  get bloodReduction(): number {
    return this.state.hitPoints.bloodReduction;
  }

  get masterReduction(): number {
    return this.state.hitPoints.masterReduction;
  }

  get maximumReduction(): number {
    return this.bloodReduction + this.masterReduction;
  }

  get maximum(): number {
    return effectiveMaximum(this.state.hitPoints);
  }

  get temporary(): number {
    return this.state.temporaryHitPoints;
  }

  get suppressed(): boolean {
    return traitsSuppressed(this.state.suppression);
  }

  get firedUpon(): boolean {
    return suppressedByFire(this.state.suppression);
  }

  get hitDice(): ResourcePool | null {
    const { hitDice } = this.state;
    if (hitDice === undefined) return null;
    return ResourcePool.from({ maximum: hitDice.total, remaining: hitDice.remaining }, HIT_DICE_RU);
  }

  takeDamage(damage: number, options: { fire?: boolean } = {}): { vitality: Vitality; absorbed: number } {
    if (!isPossibleHitPointChange(damage)) {
      throw new DomainError(`Урон должен быть целым положительным, получено: ${damage}`);
    }
    const absorbed = Math.min(this.temporary, damage);
    const vitality = this.with({
      temporaryHitPoints: this.temporary - absorbed,
      hitPoints: {
        ...this.state.hitPoints,
        current: Math.max(0, this.current - (damage - absorbed)),
      },
      ...(options.fire === true
        ? {
            suppression: {
              ...this.state.suppression,
              firedUponTurnStarts: FIRE_SUPPRESSION_TURN_STARTS,
            },
          }
        : {}),
    });
    return { vitality, absorbed };
  }

  heal(amount: number): { vitality: Vitality; restored: number } {
    if (!isPossibleHitPointChange(amount)) {
      throw new DomainError(`Лечение должно быть целым положительным, получено: ${amount}`);
    }
    const current = Math.min(this.maximum, this.current + amount);
    const restored = current - this.current;
    if (restored === 0) {
      throw new DomainError("Здоровье уже на максимуме");
    }
    return { vitality: this.with({ hitPoints: { ...this.state.hitPoints, current } }), restored };
  }

  healUpTo(amount: number): { vitality: Vitality; restored: number } {
    const restored = Math.min(this.maximum - this.current, Math.max(0, amount));
    if (restored === 0) return { vitality: this, restored: 0 };
    return {
      vitality: this.with({ hitPoints: { ...this.state.hitPoints, current: this.current + restored } }),
      restored,
    };
  }

  grantTemporary(amount: number): Vitality {
    return this.with({ temporaryHitPoints: Math.max(this.temporary, amount) });
  }

  grantTemporaryExplicitly(amount: number): Vitality {
    if (!isPossibleHitPointChange(amount)) {
      throw new DomainError(`Временные хиты должны быть целым положительным, получено: ${amount}`);
    }
    if (amount <= this.temporary) {
      throw new DomainError(
        `Временных хитов уже ${this.temporary}: они не складываются, меньшее не берётся`,
      );
    }
    return this.grantTemporary(amount);
  }

  spendHitDice(count: number): Vitality {
    const pool = this.hitDice;
    const { hitDice } = this.state;
    if (pool === null || hitDice === undefined || pool.remaining < count) {
      throw new DomainError(
        `Неистраченных Костей хитов ${pool?.remaining ?? 0}, а брошено ${count}`,
      );
    }
    return this.with({ hitDice: { ...hitDice, remaining: pool.remaining - count } });
  }

  restoreHitDice(count: number): Vitality {
    const { hitDice } = this.state;
    if (hitDice === undefined) return this;
    return this.with({
      hitDice: { ...hitDice, remaining: Math.min(hitDice.total, hitDice.remaining + count) },
    });
  }

  payWithBlood(hitPoints: number, options: { allowAnyway?: boolean } = {}): Vitality {
    const suppression = suppressionReason(this.state.suppression);
    if (suppression !== null && options.allowAnyway !== true) {
      throw new DomainError(suppression);
    }
    if (!Number.isInteger(hitPoints) || hitPoints <= 0) {
      throw new DomainError(`Цена ячейки в хитах должна быть целой положительной, получено: ${hitPoints}`);
    }
    if (hitPoints > this.current && options.allowAnyway !== true) {
      throw new DomainError(`Нужно ${hitPoints} хитов, в наличии ${this.current}`);
    }
    return this.with({
      hitPoints: {
        ...this.state.hitPoints,
        current: this.current - hitPoints,
        bloodReduction: this.bloodReduction + hitPoints,
      },
    });
  }

  private get regenerating(): boolean {
    return !this.suppressed && this.current > 0;
  }

  regenerationDue(characterLevel: number): number {
    if (!this.regenerating) return 0;
    if (this.current >= this.maximum / 2) return 0;
    return regenerationPerTurn(characterLevel);
  }

  continuousRegenerationDue(): number {
    if (!this.regenerating) return 0;
    return Math.max(0, Math.floor(this.maximum / 2) - this.current);
  }

  regeneratedContinuously(): { vitality: Vitality; healed: number } {
    const { vitality, restored } = this.healUpTo(this.continuousRegenerationDue());
    return { vitality, healed: restored };
  }

  afterAnHour(characterLevel: number): { vitality: Vitality; returned: number; healed: number } {
    if (this.suppressed) return { vitality: this, returned: 0, healed: 0 };
    const returned = Math.min(maximumRecoveryPerHour(characterLevel), this.bloodReduction);
    const grown = this.with({
      hitPoints: { ...this.state.hitPoints, bloodReduction: this.bloodReduction - returned },
    });
    const { vitality, healed } = grown.regeneratedContinuously();
    return { vitality, returned, healed };
  }

  setSunlight(underSunlight: boolean): Vitality {
    if (this.state.suppression.underDirectSunlight === underSunlight) {
      throw new DomainError("Признак солнечного света уже в этом состоянии");
    }
    return this.with({
      suppression: { ...this.state.suppression, underDirectSunlight: underSunlight },
    });
  }

  afterTurnStart(): Vitality {
    const { firedUponTurnStarts } = this.state.suppression;
    return this.with({
      suppression: {
        ...this.state.suppression,
        firedUponTurnStarts: Math.max(0, firedUponTurnStarts - 1),
      },
    });
  }

  clearFireSuppression(): Vitality {
    return this.with({ suppression: { ...this.state.suppression, firedUponTurnStarts: 0 } });
  }

  restoredByLongRest(bloodReduction: number): Vitality {
    const maximum = effectiveMaximum({
      maximumBase: this.maximumBase,
      bloodReduction,
      masterReduction: this.masterReduction,
    });
    return this.with({
      hitPoints: { ...this.state.hitPoints, current: maximum, bloodReduction },
    });
  }

  resizedHitDice(total: number): Vitality {
    const { hitDice } = this.state;
    if (hitDice === undefined) return this;
    const pool = ResourcePool.from(
      { maximum: hitDice.total, remaining: hitDice.remaining },
      HIT_DICE_RU,
    ).resized(total);
    return this.with({ hitDice: { ...hitDice, total: pool.maximum, remaining: pool.remaining } });
  }

  maximumWith(change: { maximumBase: number; masterReduction: number }): number | null {
    if (
      !isPossibleHitPointMaximum(change.maximumBase) ||
      !isPossibleReduction(change.masterReduction)
    ) {
      return null;
    }
    return this.withMaximumBase(change.maximumBase)
      .withMasterReduction(change.masterReduction)
      .maximum;
  }

  withMaximumBase(maximumBase: number): Vitality {
    if (!isPossibleHitPointMaximum(maximumBase)) {
      throw new DomainError(
        `Максимум хитов должен быть целым положительным, получено: ${maximumBase}`,
      );
    }
    return this.clamped({ ...this.state.hitPoints, maximumBase });
  }

  withMasterReduction(masterReduction: number): Vitality {
    if (!isPossibleReduction(masterReduction)) {
      throw new DomainError(
        `Снижение должно быть целым неотрицательным, получено: ${masterReduction}`,
      );
    }
    return this.clamped({ ...this.state.hitPoints, masterReduction });
  }

  private clamped(hitPoints: VitalityState["hitPoints"]): Vitality {
    const maximum = effectiveMaximum(hitPoints);
    return this.with({ hitPoints: { ...hitPoints, current: Math.min(hitPoints.current, maximum) } });
  }

  dropTemporary(): Vitality {
    return this.with({ temporaryHitPoints: 0 });
  }

  toState(): VitalityState {
    return this.state;
  }
}
