/**
 * Доска эффектов: что сейчас действует и что из этого держится концентрацией.
 *
 * Активные эффекты и концентрация — один агрегат, потому что согласованы между собой: концентрация
 * без своего эффекта и второй концентрационный эффект одинаково означают испорченное состояние.
 */

import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import type { ActiveEffect, CharacterState } from "@/core/domain/character/state";

export type EffectBoardState = Pick<CharacterState, "activeEffects" | "concentration">;

export type ConcentrationEnd = "manual" | "failed_check" | "replaced" | "long_rest";

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
  expire(elapsedRounds: (effect: ActiveEffect) => number): {
    board: EffectBoard;
    expired: ActiveEffect[];
  } {
    const kept: ActiveEffect[] = [];
    const expired: ActiveEffect[] = [];

    for (const effect of this.state.activeEffects) {
      const rounds = effect.duration.type === "rounds" ? effect.duration.value : undefined;
      if (rounds === undefined) {
        kept.push(effect);
        continue;
      }
      (elapsedRounds(effect) >= rounds ? expired : kept).push(effect);
    }

    const losesConcentration = expired.some((effect) => effect.isConcentration);
    return {
      board: this.with(kept, losesConcentration ? undefined : this.state.concentration),
      expired,
    };
  }

  /** Долгий отдых закрывает всё, что короче него; «до рассеивания» и подобное остаётся. */
  afterLongRest(): EffectBoard {
    return this.with(
      this.state.activeEffects.filter((effect) => effect.duration.type === "special"),
      undefined,
    );
  }

  toState(): EffectBoardState {
    return this.state;
  }
}
