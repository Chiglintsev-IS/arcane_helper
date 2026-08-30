import { outlastsLongRest } from "@/core/domain/effects/duration";
import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import type { Spell } from "@/core/domain/catalog/spell";
import type { ContributionSource, SourcedContribution } from "@/core/domain/shared/stats";
import type { ActiveEffect, EffectsState } from "./schema";

type EffectBoardState = EffectsState;

type Expiry = { board: EffectBoard; expired: ActiveEffect[] };

export const CONCENTRATION_ENDS = ["manual", "failed_check", "replaced", "long_rest"] as const;

export type ConcentrationEnd = (typeof CONCENTRATION_ENDS)[number];

function contributionsOf(
  nameRu: string,
  contributions: Spell["contributions"],
): SourcedContribution[] {
  const source: ContributionSource = { origin: "effect", nameRu };
  return contributions.map((contribution) => ({ source, contribution }));
}

function concentrationSpellId(effect: ActiveEffect): string {
  if (effect.spellId === undefined) {
    throw new DomainError("Концентрационный эффект обязан ссылаться на заклинание");
  }
  return effect.spellId;
}

export class EffectBoard {
  private constructor(private readonly state: EffectBoardState) {}

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

  expire(elapsedRounds: (effect: ActiveEffect) => number): Expiry {
    return this.dropRounds((effect, rounds) => elapsedRounds(effect) >= rounds);
  }

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

  afterLongRest(): Expiry {
    const kept: ActiveEffect[] = [];
    const expired: ActiveEffect[] = [];

    for (const effect of this.state.activeEffects) {
      const survives = !effect.isConcentration && outlastsLongRest(effect.duration);
      (survives ? kept : expired).push(effect);
    }

    return { board: this.with(kept, undefined), expired };
  }

  contributions(): readonly SourcedContribution[] {
    return this.state.activeEffects.flatMap((effect) =>
      contributionsOf(effect.nameRu, effect.contributions),
    );
  }

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

  manualEffect(kind: NonNullable<ActiveEffect["manualKind"]>): ActiveEffect | undefined {
    return this.state.activeEffects.find((effect) => effect.manualKind === kind);
  }

  manualAdjustment(kind: NonNullable<ActiveEffect["manualKind"]>): number {
    const [contribution] = this.manualEffect(kind)?.contributions ?? [];
    return contribution?.kind === "bonus" ? contribution.value : 0;
  }

  toState(): EffectBoardState {
    return this.state;
  }
}
