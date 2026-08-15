/**
 * Доска эффектов: что сейчас действует и что из этого держится концентрацией.
 *
 * Активные эффекты и концентрация — один объект-значение, потому что согласованы между собой:
 * концентрация без своего эффекта и второй концентрационный эффект одинаково означают испорченное
 * состояние.
 */

import { outlastsLongRest } from "@/core/domain/effects/duration";
import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import type { Spell } from "@/core/domain/catalog/spell";
import type { ContributionSource, SourcedContribution } from "@/core/domain/shared/stats";
import type { ActiveEffect, EffectsState } from "./schema";

type EffectBoardState = EffectsState;

/** Доска после истечения и то, что с неё ушло: подпись в журнале обязана назвать снятое. */
type Expiry = { board: EffectBoard; expired: ActiveEffect[] };

/** Отчего концентрация кончилась — перечнем: тем же списком сужается слово, пришедшее снаружи. */
export const CONCENTRATION_ENDS = ["manual", "failed_check", "replaced", "long_rest"] as const;

export type ConcentrationEnd = (typeof CONCENTRATION_ENDS)[number];

/** Вклады одного действующего с их источником: имя — то, чем игрок это назвал. */
function contributionsOf(
  nameRu: string,
  contributions: Spell["contributions"],
): SourcedContribution[] {
  const source: ContributionSource = { origin: "effect", nameRu };
  return contributions.map((contribution) => ({ source, contribution }));
}

/** Концентрация ссылается на заклинание; эффект, заведённый вручную, её не держит. */
function concentrationSpellId(effect: ActiveEffect): string {
  if (effect.spellId === undefined) {
    throw new DomainError("Концентрационный эффект обязан ссылаться на заклинание");
  }
  return effect.spellId;
}

export class EffectBoard {
  private constructor(private readonly state: EffectBoardState) {}

  /** Владеет только своими полями: иначе агрегат затирал бы правки соседа. */
  private static readonly KEYS = ["activeEffects", "concentration"] as const satisfies readonly (keyof EffectBoardState)[];

  static of(state: EffectBoardState): EffectBoard {
    return new EffectBoard(ownedFields(state, EffectBoard.KEYS));
  }

  private with(effects: ActiveEffect[], concentration: EffectBoardState["concentration"]): EffectBoard {
    return new EffectBoard({
      activeEffects: effects,
      ...(concentration === undefined ? {} : { concentration }),
    });
  }

  /**
   * Новый эффект. Концентрационный вытесняет прежний одним переходом — двух одновременно не бывает.
   *
   * `holdsConcentration` отделено от самого эффекта: раундовый эффект, созданный вне схватки,
   * истекает в тот же миг и внимания не занимает, хотя заклинание концентрационное.
   */
  start(effect: ActiveEffect, startedAt: string): EffectBoard {
    const kept = effect.isConcentration
      ? this.state.activeEffects.filter((existing) => !existing.isConcentration)
      : this.state.activeEffects;
    return this.with(
      [...kept, effect],
      effect.isConcentration
        ? { spellId: concentrationSpellId(effect), startedAt }
        : this.state.concentration,
    );
  }

  /** Снимает концентрацию и называет, чью: подпись в журнале обязана назвать заклинание. */
  endConcentration(): { board: EffectBoard; spellId: string } {
    const current = this.state.concentration;
    if (current === undefined) {
      throw new DomainError("Активной концентрации нет");
    }
    return {
      board: this.with(this.state.activeEffects.filter((effect) => !effect.isConcentration), undefined),
      spellId: current.spellId,
    };
  }

  end(effectId: string): { board: EffectBoard; ended: ActiveEffect } {
    const ended = this.state.activeEffects.find((candidate) => candidate.id === effectId);
    if (ended === undefined) {
      throw new DomainError(`Активного эффекта «${effectId}» нет`);
    }
    const rest = this.state.activeEffects.filter((candidate) => candidate.id !== effectId);
    return {
      board: ended.isConcentration ? this.with(rest, undefined) : this.with(rest, this.state.concentration),
      ended,
    };
  }

  /**
   * Истечение раундовых эффектов. Сколько раундов прошло, решает вызывающий: раунды считаются по
   * журналу, а доска эффектов про журнал не знает.
   */
  expire(elapsedRounds: (effect: ActiveEffect) => number): Expiry {
    return this.dropRounds((effect, rounds) => elapsedRounds(effect) >= rounds);
  }

  /** Конец схватки: раундов вне боя нет, и раундовое кончается вместе с ней — весь остаток сразу. */
  afterCombat(): Expiry {
    return this.dropRounds(() => true);
  }

  private dropRounds(isOver: (effect: ActiveEffect, rounds: number) => boolean): Expiry {
    const kept: ActiveEffect[] = [];
    const expired: ActiveEffect[] = [];

    for (const effect of this.state.activeEffects) {
      const rounds = effect.duration.type === "rounds" ? effect.duration.value : undefined;
      if (rounds === undefined) {
        kept.push(effect);
        continue;
      }
      (isOver(effect, rounds) ? expired : kept).push(effect);
    }

    const losesConcentration = expired.some((effect) => effect.isConcentration);
    return {
      board: this.with(kept, losesConcentration ? undefined : this.state.concentration),
      expired,
    };
  }

  /**
   * Долгий отдых. Переживёт ли его эффект, отвечает его собственный срок.
   *
   * Концентрация сна не переживает ни при каком сроке, и её эффект уходит вместе с ней: эффект
   * концентрации без самой концентрации — такая же испорченная доска, как и обратное.
   */
  afterLongRest(): Expiry {
    const kept: ActiveEffect[] = [];
    const expired: ActiveEffect[] = [];

    for (const effect of this.state.activeEffects) {
      const survives = !effect.isConcentration && outlastsLongRest(effect.duration);
      (survives ? kept : expired).push(effect);
    }

    return { board: this.with(kept, undefined), expired };
  }

  /**
   * Что действующее приносит листу: копии вкладов с именем того, кто их держит.
   *
   * Заклинание и заведённая мастером поправка приходят одинаково: для счёта они и есть одно, а
   * различает их разве что подпись в разборе.
   */
  contributions(): readonly SourcedContribution[] {
    return this.state.activeEffects.flatMap((effect) =>
      contributionsOf(effect.nameRu, effect.contributions),
    );
  }

  /**
   * Какими станут вклады, если сотворить заклинание, — предпросмотр до подтверждения.
   *
   * Повторное применение того же заклинания вклад не удваивает: второй «Щит» поверх первого не
   * даёт десяти. Узнаётся это по заклинанию, а не по совпадению чисел, и потому здесь, а не в
   * свёртке: движок вкладов одинаковых от разных не отличает и отличать не должен.
   */
  contributionsWith(
    spell: Pick<Spell, "id" | "nameRu" | "contributions">,
  ): readonly SourcedContribution[] {
    const alreadyActive = this.state.activeEffects.some(
      (effect) => effect.spellId === spell.id && effect.contributions.length > 0,
    );
    return alreadyActive
      ? this.contributions()
      : [...this.contributions(), ...contributionsOf(spell.nameRu, spell.contributions)];
  }

  /** Эффект, заведённый шапкой ресурсов: опознаётся признаком рода, а не подписью. */
  manualEffect(kind: NonNullable<ActiveEffect["manualKind"]>): ActiveEffect | undefined {
    return this.state.activeEffects.find((effect) => effect.manualKind === kind);
  }

  /**
   * Число заведённой вручную поправки: ноль означает, что её нет вовсе.
   *
   * Доска отдаёт записанное, а не считает по правилам: какой величины касается поправка, сказано в
   * самом вкладе, и доска в это не заглядывает дальше вида «прибавка».
   */
  manualAdjustment(kind: NonNullable<ActiveEffect["manualKind"]>): number {
    const [contribution] = this.manualEffect(kind)?.contributions ?? [];
    return contribution?.kind === "bonus" ? contribution.value : 0;
  }

  toState(): EffectBoardState {
    return this.state;
  }
}
