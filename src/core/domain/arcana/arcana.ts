import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import { ResourcePool } from "@/core/domain/shared/resourcePool";
import {
  applyArcaneRecovery,
  arcaneRecoveryBudget,
  arcaneRecoveryPlanCost,
  refundSlot,
  resizeSlots,
  restoreAllSlots,
  spendSlot,
  type SlotRecoveryPlan,
} from "./slots";
import { runesMaximum } from "./runes";

import type { ArcanaStateData } from "./schema";

type ArcanaState = Pick<
  ArcanaStateData,
  | "spellSlots"
  | "runes"
  | "lastHint"
  | "arcaneRecovery"
  | "shortRestSinceLongRest"
>;

const RUNES_RU = "Рун";
export const LAST_HINT_RU = "Последняя подсказка";
export const WARDING_SIGIL_RU = "Знаки ограждения";
const ARCANE_RECOVERY_RU = "Бюджет магического восстановления";

export class Arcana {
  private constructor(private readonly state: ArcanaState) {}

  private static readonly KEYS = [
    "spellSlots",
    "runes",
    "lastHint",
    "arcaneRecovery",
    "shortRestSinceLongRest",
  ] as const satisfies readonly (keyof ArcanaState)[];

  static of(state: ArcanaState): Arcana {
    return new Arcana(ownedFields(state, Arcana.KEYS));
  }

  private with(change: Partial<ArcanaState>): Arcana {
    return new Arcana({ ...this.state, ...change });
  }

  get runes(): ResourcePool {
    return ResourcePool.from(this.state.runes, RUNES_RU);
  }

  spendSlot(slotLevel: number, options: { allowOverdraft?: boolean } = {}): Arcana {
    return this.with({ spellSlots: spendSlot(this.state.spellSlots, slotLevel, options) });
  }

  refundSlot(slotLevel: number): Arcana {
    return this.with({ spellSlots: refundSlot(this.state.spellSlots, slotLevel) });
  }

  spendRune(): Arcana {
    if (this.runes.depleted) {
      throw new DomainError("Рун не осталось");
    }
    return this.with({ runes: this.runes.spend(RUNES_RU).toState() });
  }

  shiftRunes(delta: number): Arcana {
    return this.with({ runes: this.runes.shift(delta, RUNES_RU).toState() });
  }

  get lastHint(): ResourcePool {
    return ResourcePool.from(this.state.lastHint, LAST_HINT_RU);
  }

  shiftLastHint(delta: number): Arcana {
    return this.with({ lastHint: this.lastHint.shift(delta, LAST_HINT_RU).toState() });
  }

  markShortRest(): Arcana {
    return this.with({ shortRestSinceLongRest: true });
  }

  arcaneRecoveryUnavailability(): string | null {
    if (this.state.arcaneRecovery.remaining <= 0) {
      return "Дневной бюджет восстановления исчерпан до следующего долгого отдыха";
    }
    if (this.state.shortRestSinceLongRest !== true) return "Берётся после короткого отдыха";
    return null;
  }

  useArcaneRecovery(plan: SlotRecoveryPlan): Arcana {
    const budget = ResourcePool.from(this.state.arcaneRecovery, ARCANE_RECOVERY_RU);
    const spellSlots = applyArcaneRecovery(this.state.spellSlots, plan, budget.remaining);
    return this.with({
      spellSlots,
      arcaneRecovery: budget.spend(ARCANE_RECOVERY_RU, arcaneRecoveryPlanCost(plan)).toState(),
    });
  }

  resizedForLevel(wizardLevel: number, proficiencyBonus: number): Arcana {
    return this.with({
      spellSlots: resizeSlots(this.state.spellSlots, wizardLevel),
      runes: this.runes.resized(runesMaximum(proficiencyBonus)).toState(),
      arcaneRecovery: ResourcePool.from(this.state.arcaneRecovery, ARCANE_RECOVERY_RU)
        .resized(arcaneRecoveryBudget(wizardLevel))
        .toState(),
    });
  }

  restoredByLongRest(): Arcana {
    return this.with({
      spellSlots: restoreAllSlots(this.state.spellSlots),
      runes: this.runes.restored().toState(),
      lastHint: this.lastHint.restored().toState(),
      arcaneRecovery: ResourcePool.from(this.state.arcaneRecovery, ARCANE_RECOVERY_RU).restored().toState(),
      shortRestSinceLongRest: false,
    });
  }

  toState(): ArcanaState {
    return this.state;
  }
}
