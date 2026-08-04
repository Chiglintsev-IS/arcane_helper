/**
 * Магические ресурсы: чем платят за сотворение.
 *
 * Агрегат владеет ячейками, рунами, очками заклинаний, дневным бюджетом магического восстановления
 * и отметкой короткого отдыха, которая его открывает. Снаружи их не правят напрямую — иначе проверка
 * границ пришлось бы повторять у каждого вызывающего, и однажды её бы забыли.
 */

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
  type SpellSlots,
} from "./slots";
import { spellPointCost } from "./slots";
import { runesMaximum } from "./runes";

import type { ArcanaStateData } from "./schema";

/** Состояние, которым владеет агрегат. */
type ArcanaState = Pick<
  ArcanaStateData,
  "spellSlots" | "runes" | "spellPoints" | "arcaneRecovery" | "shortRestSinceLongRest"
>;

const RUNES_RU = "Рун";
const ARCANE_RECOVERY_RU = "Бюджет магического восстановления";

export class Arcana {
  private constructor(private readonly state: ArcanaState) {}

  /** Владеет только своими полями: иначе агрегат затирал бы правки соседа. */
  private static readonly KEYS = [
    "spellSlots",
    "runes",
    "spellPoints",
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

  /** Короткий отдых был: отметка держится до долгого отдыха, который её и снимает. */
  markShortRest(): Arcana {
    return this.with({ shortRestSinceLongRest: true });
  }

  /**
   * Почему «Магическое восстановление» сейчас не берётся; `null` — берётся.
   *
   * Причина названа словами, потому что и отказ, и погашенная кнопка обязаны говорить одно и то же.
   */
  arcaneRecoveryUnavailability(): string | null {
    if (this.state.arcaneRecovery.remaining <= 0) {
      return "Дневной бюджет восстановления исчерпан до следующего долгого отдыха";
    }
    if (this.state.shortRestSinceLongRest !== true) return "Берётся после короткого отдыха";
    return null;
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
  resizedForLevel(wizardLevel: number, proficiencyBonus: number): Arcana {
    return this.with({
      spellSlots: resizeSlots(this.state.spellSlots, wizardLevel),
      runes: this.runes.resized(runesMaximum(proficiencyBonus)).toState(),
      arcaneRecovery: ResourcePool.from(this.state.arcaneRecovery, ARCANE_RECOVERY_RU)
        .resized(arcaneRecoveryBudget(wizardLevel))
        .toState(),
    });
  }

  /**
   * Долгий отдых возвращает всё разом; очки при этом гаснут — тот же итог, что и у любого часа.
   * Отметка короткого отдыха снимается: восстановление снова ждёт короткого.
   */
  restoredByLongRest(): Arcana {
    return this.with({
      spellSlots: restoreAllSlots(this.state.spellSlots),
      runes: this.runes.restored().toState(),
      arcaneRecovery: ResourcePool.from(this.state.arcaneRecovery, ARCANE_RECOVERY_RU).restored().toState(),
      spellPoints: { remaining: 0 },
      shortRestSinceLongRest: false,
    });
  }

  toState(): ArcanaState {
    return this.state;
  }
}
