/**
 * Магические ресурсы: чем платят за сотворение.
 *
 * Агрегат владеет ячейками, рунами, очками заклинаний и признаком магического восстановления.
 * Снаружи их не правят напрямую — иначе проверка границ пришлось бы повторять у каждого
 * вызывающего, и однажды её бы забыли.
 */

import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import type { CharacterState } from "@/core/domain/character/state";
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
  type SpellSlots,
} from "./slots";
import { spellPointCost } from "@/core/domain/vitality/blood";

export type ArcanaState = Pick<
  CharacterState,
  "spellSlots" | "runes" | "spellPoints" | "arcaneRecovery"
>;

const RUNES_RU = "Рун";
const ARCANE_RECOVERY_RU = "Бюджет магического восстановления";

export class Arcana {
  private constructor(private readonly state: ArcanaState) {}

  /** Владеет только своими полями: иначе агрегат затирал бы правки соседа. */
  private static readonly KEYS = ["spellSlots", "runes", "spellPoints", "arcaneRecovery"] as const satisfies readonly (keyof ArcanaState)[];

  static of(state: ArcanaState): Arcana {
    return new Arcana(ownedFields(state, Arcana.KEYS));
  }

  private with(change: Partial<ArcanaState>): Arcana {
    return new Arcana({ ...this.state, ...change });
  }

  get runes(): ResourcePool {
    return ResourcePool.from(this.state.runes, RUNES_RU);
  }

  get spellPoints(): number {
    return this.state.spellPoints.remaining;
  }

  /** Перерасход разрешает только мастер: тогда остаток уходит в минус и виден как долг. */
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

  spendSpellPoints(spellLevel: number, options: { allowAnyway?: boolean } = {}): Arcana {
    const cost = spellPointCost(spellLevel);
    if (this.spellPoints < cost && options.allowAnyway !== true) {
      throw new DomainError(`Очков заклинаний ${this.spellPoints}, нужно ${cost}`);
    }
    return this.with({
      spellPoints: { ...this.state.spellPoints, remaining: this.spellPoints - cost },
    });
  }

  gainSpellPoints(count: number): Arcana {
    return this.with({ spellPoints: { remaining: this.spellPoints + count } });
  }

  /** Час стирает то, что накопилось до него, независимо от того, сколько его успело набежать. */
  expireSpellPoints(): Arcana {
    return this.with({ spellPoints: { remaining: 0 } });
  }

  /**
   * Магическое восстановление. Бюджет — общий на весь день между долгими отдыхами: книга тратит его
   * одним применением, этот стол — частями, пока остаток не кончится.
   */
  useArcaneRecovery(plan: SlotRecoveryPlan): Arcana {
    const budget = ResourcePool.from(this.state.arcaneRecovery, ARCANE_RECOVERY_RU);
    const spellSlots = applyArcaneRecovery(this.state.spellSlots, plan, budget.remaining);
    return this.with({
      spellSlots,
      arcaneRecovery: budget.spend(ARCANE_RECOVERY_RU, arcaneRecoveryPlanCost(plan)).toState(),
    });
  }

  /** Смена уровня: ячейки по таблице, руны по бонусу мастерства, бюджет восстановления по формуле. */
  resizedForLevel(wizardLevel: number, runesMaximum: number): Arcana {
    return this.with({
      spellSlots: resizeSlots(this.state.spellSlots, wizardLevel),
      runes: this.runes.resized(runesMaximum).toState(),
      arcaneRecovery: ResourcePool.from(this.state.arcaneRecovery, ARCANE_RECOVERY_RU)
        .resized(arcaneRecoveryBudget(wizardLevel))
        .toState(),
    });
  }

  /** Долгий отдых возвращает всё разом; очки при этом гаснут — тот же итог, что и у любого часа. */
  restoredByLongRest(): Arcana {
    return this.with({
      spellSlots: restoreAllSlots(this.state.spellSlots),
      runes: this.runes.restored().toState(),
      arcaneRecovery: ResourcePool.from(this.state.arcaneRecovery, ARCANE_RECOVERY_RU).restored().toState(),
      spellPoints: { remaining: 0 },
    });
  }

  toState(): ArcanaState {
    return this.state;
  }
}
