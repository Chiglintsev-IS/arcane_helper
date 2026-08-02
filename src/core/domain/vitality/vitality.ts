/**
 * Жизнеспособность: здоровье персонажа и всё, чем оно платит.
 *
 * Хиты, временные хиты, снижённый кровавым колдовством максимум, Кости хитов и подавление расовых
 * особенностей меняются вместе — потому это один агрегат, а не четыре поля рядом.
 */

import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import type { CharacterState } from "@/core/domain/character/state";
import { ResourcePool } from "@/core/domain/shared/resourcePool";
import {
  exchangeHitPoints,
  maximumRecoveryPerHour,
  regenerationPerTurn,
  traitsSuppressed,
  type Exchange,
} from "./blood";

export type VitalityState = Pick<
  CharacterState,
  "hitPoints" | "temporaryHitPoints" | "hitDice" | "suppression"
>;

const HIT_DICE_RU = "Костей хитов";

export class Vitality {
  private constructor(private readonly state: VitalityState) {}

  /** Владеет только своими полями: иначе агрегат затирал бы правки соседа. */
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

  get maximum(): number {
    return this.state.hitPoints.maximum;
  }

  get maximumReduction(): number {
    return this.state.hitPoints.maximumReduction;
  }

  get temporary(): number {
    return this.state.temporaryHitPoints;
  }

  get suppressed(): boolean {
    return traitsSuppressed(this.state.suppression);
  }

  /** Кости хитов есть не у всякого состояния: чужая выгрузка могла их не знать. */
  get hitDice(): ResourcePool | null {
    const { hitDice } = this.state;
    if (hitDice === undefined) return null;
    return ResourcePool.from({ maximum: hitDice.total, remaining: hitDice.remaining }, HIT_DICE_RU);
  }

  /**
   * Урон: сначала временные хиты, остаток — по текущим.
   *
   * Возвращает и поглощённое временными, потому что подпись в журнале обязана это назвать: иначе
   * игрок видит «получено 12», а здоровье упало на 4.
   */
  takeDamage(damage: number, options: { fire?: boolean } = {}): { vitality: Vitality; absorbed: number } {
    if (!Number.isInteger(damage) || damage <= 0) {
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
        ? { suppression: { ...this.state.suppression, firedUpon: true } }
        : {}),
    });
    return { vitality, absorbed };
  }

  /**
   * Лечение до потолка. Потолок — максимум, уже уменьшенный кровавым колдовством: вычитать
   * снижение второй раз значило бы уронить максимум дважды.
   */
  heal(amount: number): { vitality: Vitality; restored: number } {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new DomainError(`Лечение должно быть целым положительным, получено: ${amount}`);
    }
    const current = Math.min(this.maximum, this.current + amount);
    const restored = current - this.current;
    if (restored === 0) {
      throw new DomainError("Здоровье уже на максимуме");
    }
    return { vitality: this.with({ hitPoints: { ...this.state.hitPoints, current } }), restored };
  }

  /** Лечение как следствие другой операции: полные хиты здесь не отказ, а просто ноль. */
  healUpTo(amount: number): { vitality: Vitality; restored: number } {
    const restored = Math.min(this.maximum - this.current, Math.max(0, amount));
    if (restored === 0) return { vitality: this, restored: 0 };
    return {
      vitality: this.with({ hitPoints: { ...this.state.hitPoints, current: this.current + restored } }),
      restored,
    };
  }

  /** Временные хиты не складываются: берётся большее из двух — таково правило. */
  grantTemporary(amount: number): Vitality {
    return this.with({ temporaryHitPoints: Math.max(this.temporary, amount) });
  }

  /** Ручное начисление отказывает на меньшем числе: игрок ввёл его сам и вправе узнать результат. */
  grantTemporaryExplicitly(amount: number): Vitality {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new DomainError(`Временные хиты должны быть целым положительным, получено: ${amount}`);
    }
    if (amount <= this.temporary) {
      throw new DomainError(
        `Временных хитов уже ${this.temporary}: они не складываются, меньшее не берётся`,
      );
    }
    return this.grantTemporary(amount);
  }

  /**
   * Трата Костей хитов сотворением. Отсутствие пула — тот же отказ, что и нехватка: чужая выгрузка
   * могла не знать про кости, и для игрока это ровно «их нет ни одной».
   */
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

  shiftHitDice(delta: number): Vitality {
    const pool = this.hitDice;
    const { hitDice } = this.state;
    if (pool === null || hitDice === undefined) {
      throw new DomainError("У персонажа не заведены кости хитов");
    }
    return this.with({ hitDice: { ...hitDice, remaining: pool.shift(delta, HIT_DICE_RU).remaining } });
  }

  restoreHitDice(count: number): Vitality {
    const { hitDice } = this.state;
    if (hitDice === undefined) return this;
    return this.with({
      hitDice: { ...hitDice, remaining: Math.min(hitDice.total, hitDice.remaining + count) },
    });
  }

  /** Обмен хитов на очки заклинаний: платит и максимум, и текущее здоровье. */
  exchangeBlood(
    hitPoints: number,
    characterLevel: number,
    options: { allowAnyway?: boolean } = {},
  ): { vitality: Vitality; exchange: Exchange } {
    if (this.suppressed && options.allowAnyway !== true) {
      throw new DomainError(
        this.state.suppression.firedUpon
          ? "Кровавое колдовство подавлено уроном огнём"
          : "Кровавое колдовство не действует под прямым солнечным светом",
      );
    }
    const exchange = exchangeHitPoints(hitPoints, characterLevel);
    if (exchange.pointsCreated === 0) {
      throw new DomainError(`${hitPoints} хитов не хватает даже на одно очко заклинаний`);
    }
    if (exchange.hitPointsSpent > this.current && options.allowAnyway !== true) {
      throw new DomainError(`Нужно ${exchange.hitPointsSpent} хитов, в наличии ${this.current}`);
    }
    return {
      vitality: this.with({
        hitPoints: {
          current: this.current - exchange.hitPointsSpent,
          maximum: this.maximum - exchange.hitPointsSpent,
          maximumReduction: this.maximumReduction + exchange.hitPointsSpent,
        },
      }),
      exchange,
    };
  }

  /** Регенерация тролля: ниже половины максимума и только пока особенности не подавлены. */
  regenerationDue(characterLevel: number): number {
    if (this.suppressed) return 0;
    if (this.current <= 0) return 0;
    if (this.current >= this.maximum / 2) return 0;
    return regenerationPerTurn(characterLevel);
  }

  /**
   * Час без солнца и без огня: ступень снижённого максимума возвращается, регенерация успевает
   * дойти до половины. Порог считается от нового максимума — он только что вырос.
   */
  afterAnHour(characterLevel: number): { vitality: Vitality; returned: number; healed: number } {
    if (this.suppressed) return { vitality: this, returned: 0, healed: 0 };
    const returned = Math.min(maximumRecoveryPerHour(characterLevel), this.maximumReduction);
    const maximum = this.maximum + returned;
    const current = Math.max(this.current, Math.floor(maximum / 2));
    return {
      vitality: this.with({
        hitPoints: { current, maximum, maximumReduction: this.maximumReduction - returned },
      }),
      returned,
      healed: current - this.current,
    };
  }

  /** Сколько вернёт конец боя: регенерация вне схватки идёт непрерывно до половины максимума. */
  combatEndRecovery(): number {
    return Math.max(0, Math.floor(this.maximum / 2) - this.current);
  }

  setSunlight(underSunlight: boolean): Vitality {
    if (this.state.suppression.underDirectSunlight === underSunlight) {
      throw new DomainError("Признак солнечного света уже в этом состоянии");
    }
    return this.with({
      suppression: { ...this.state.suppression, underDirectSunlight: underSunlight },
    });
  }

  /** Подавление огнём держится до конца следующего хода, поэтому снимается его началом. */
  clearFireSuppression(): Vitality {
    return this.with({ suppression: { ...this.state.suppression, firedUpon: false } });
  }

  withHitPointMaximum(maximum: number, maximumReduction: number): Vitality {
    return this.with({ hitPoints: { current: maximum, maximum, maximumReduction } });
  }

  dropTemporary(): Vitality {
    return this.with({ temporaryHitPoints: 0 });
  }

  toState(): VitalityState {
    return this.state;
  }
}
