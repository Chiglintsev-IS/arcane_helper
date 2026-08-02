/**
 * Концентрация и активные эффекты: завершение вручную, по провалу проверки и по замене.
 */

import { Character } from "@/core/domain/character/character";
import type { CharacterState } from "@/core/domain/character/state";
import type { ConcentrationEnd } from "@/core/domain/effects/effectBoard";
import { DomainError } from "@/core/domain/shared/errors";
import { commit, type Clock, type Session } from "@/core/application/session";

export type { ConcentrationEnd };

const CONCENTRATION_REASONS: Record<ConcentrationEnd, string> = {
  manual: "снята вручную",
  failed_check: "провалена проверка концентрации",
  replaced: "заменена концентрация",
  long_rest: "долгий отдых",
};

/** Завершает концентрацию и связанный эффект одной операцией. */
export function endConcentration(
  session: Session,
  reason: ConcentrationEnd,
  clock: Clock,
): Session {
  const root = Character.of(session.character);
  const { board, spellId } = root.effects.endConcentration();
  return commit(
    session,
    root.withEffects(board),
    {
      kind: "concentration_ended",
      summaryRu: `Концентрация завершена: ${CONCENTRATION_REASONS[reason]}`,
      spellId,
    },
    clock,
  );
}

/**
 * Можно ли спасти провал проверки концентрации руной.
 * Проверка концентрации — спасбросок Телосложения, значит «Знаки ограждения» применимы.
 */
export function wardingSigilAvailable(character: CharacterState): boolean {
  return !Character.of(character).arcana.runes.depleted && character.reactionAvailable;
}

/** «Знаки ограждения»: реакция и руна превращают провал спасброска в успех. */
export function spendRuneOnWardingSigil(session: Session, clock: Clock): Session {
  const { character } = session;
  if (!wardingSigilAvailable(character)) {
    throw new DomainError(
      Character.of(character).arcana.runes.depleted
        ? "Рун не осталось"
        : "Реакция уже израсходована",
    );
  }
  const root = Character.of(character);
  const after: CharacterState = {
    ...root.withArcana(root.arcana.spendRune()).toState(),
    reactionAvailable: false,
  };
  return commit(
    session,
    after,
    {
      kind: "rune_spent",
      summaryRu: "Знаки ограждения: провал спасброска считается успехом",
      actionUsed: "reaction",
    },
    clock,
  );
}

/** Ручное завершение активного эффекта. */
export function endEffect(session: Session, effectId: string, clock: Clock): Session {
  const root = Character.of(session.character);
  const { board, ended } = root.effects.end(effectId);
  return commit(
    session,
    root.withEffects(board),
    { kind: "effect_ended", summaryRu: `Эффект завершён: ${ended.nameRu}`, spellId: ended.spellId },
    clock,
  );
}
