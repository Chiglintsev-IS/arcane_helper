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
  refundSlot,
  restoreAllSlots,
  spendSlot,
  type SlotRecoveryPlan,
  type SpellSlots,
} from "./slots";
import { spellPointCost } from "@/core/domain/vitality/blood";

export type ArcanaState = Pick<
  CharacterState,
  "spellSlots" | "runes" | "spellPoints" | "arcaneRecoveryAvailable"
>;

const RUNES_RU = "Рун";

export class Arcana {
  private constructor(private readonly state: ArcanaState) {}

  /** Владеет только своими полями: иначе агрегат затирал бы правки соседа. */
  private static readonly KEYS = ["spellSlots", "runes", "spellPoints", "arcaneRecoveryAvailable"] as const satisfies readonly (keyof ArcanaState)[];

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

  /** Очки не существуют без времени создания: игроку показывают, когда они появились. */
  gainSpellPoints(count: number, at: string): Arcana {
    return this.with({ spellPoints: { remaining: this.spellPoints + count, createdAt: at } });
  }

  useArcaneRecovery(plan: SlotRecoveryPlan, wizardLevel: number): Arcana {
    if (!this.state.arcaneRecoveryAvailable) {
      throw new DomainError("Магическое восстановление уже использовано до следующего долгого отдыха");
    }
    return this.with({
      spellSlots: applyArcaneRecovery(this.state.spellSlots, plan, wizardLevel),
      arcaneRecoveryAvailable: false,
    });
  }

  /** Долгий отдых возвращает всё разом и гасит очки заклинаний: они живут только до отдыха. */
  restoredByLongRest(): Arcana {
    return this.with({
      spellSlots: restoreAllSlots(this.state.spellSlots),
      runes: this.runes.restored().toState(),
      arcaneRecoveryAvailable: true,
      spellPoints: { remaining: 0, createdAt: null },
    });
  }

  toState(): ArcanaState {
    return this.state;
  }
}
