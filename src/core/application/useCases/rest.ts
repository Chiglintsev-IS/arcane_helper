import { Character } from "@/core/domain/assembly/character";
import type { SlotRecoveryPlan } from "@/core/domain/arcana/slots";
import { DomainError } from "@/core/domain/shared/errors";
import { LONG_REST_HOURS, maximumReductionAfterHours } from "@/core/domain/vitality/blood";
import { hitDiceRegainedOnLongRest } from "@/core/domain/vitality/hitDice";
import { SHORT_REST_DURATION_RU } from "@/core/domain/vitality/shortRest";
import { commit, type Occasion, type Session } from "@/core/application/session";
import { regenerationNote } from "./health";
import { expiryNotes, inFight } from "./turn";

function restSummary(title: string, notes: readonly string[]): string {
  return notes.length === 0 ? title : `${title} · ${notes.join(", ")}`;
}

export function longRest(session: Session, occasion: Occasion): Session {
  const unavailability = longRestUnavailability(session);
  if (unavailability !== null) {
    throw new DomainError(unavailability);
  }
  const root = Character.of(session.character);
  const reduction = maximumReductionAfterHours(
    root.vitality.bloodReduction,
    root.base.level,
    LONG_REST_HOURS,
  );

  const dice = session.character.hitDice;
  const vitality = root.vitality
    .restoredByLongRest(reduction)
    .dropTemporary()
    .clearFireSuppression()
    .restoreHitDice(dice === undefined ? 0 : hitDiceRegainedOnLongRest(dice.total));

  const { board, expired } = root.effects.afterLongRest();
  const after = root
    .withVitality(vitality)
    .withArcana(root.arcana.restoredByLongRest())
    .withEffects(board);

  return commit(
    session,
    after,
    { kind: "long_rest", summaryRu: restSummary("Долгий отдых", expiryNotes(expired)) },
    occasion,
  );
}

export function shortRest(session: Session, occasion: Occasion): Session {
  const unavailability = shortRestUnavailability(session);
  if (unavailability !== null) {
    throw new DomainError(unavailability);
  }
  const root = Character.of(session.character);
  const { vitality, healed } = root.vitality.clearFireSuppression().regeneratedContinuously();

  const after = root.withVitality(vitality).withArcana(root.arcana.markShortRest());

  return commit(
    session,
    after,
    { kind: "short_rest", summaryRu: restSummary("Короткий отдых", regenerationNote(healed)) },
    occasion,
  );
}

export function shortRestUnavailability(session: Session): string | null {
  return inFight(session) ? IN_FIGHT_SHORT_REST_REASON : null;
}

const IN_FIGHT_SHORT_REST_REASON = `Пока идёт бой, короткий отдых недоступен: ${SHORT_REST_DURATION_RU} между двумя ходами не проходят`;

export function longRestUnavailability(session: Session): string | null {
  return inFight(session) ? "Пока идёт бой, долгий отдых недоступен" : null;
}

export function arcaneRecoveryUnavailability(session: Session): string | null {
  if (inFight(session)) return "Пока идёт бой, магическое восстановление недоступно";
  return Character.of(session.character).arcana.arcaneRecoveryUnavailability();
}

export function useArcaneRecovery(
  session: Session,
  plan: SlotRecoveryPlan,
  occasion: Occasion,
): Session {
  const unavailability = arcaneRecoveryUnavailability(session);
  if (unavailability !== null) {
    throw new DomainError(unavailability);
  }
  const root = Character.of(session.character);
  const after = root.withArcana(root.arcana.useArcaneRecovery(plan));
  const returned = Object.entries(plan)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${count}×${level} ур.`)
    .join(", ");
  return commit(
    session,
    after,
    { kind: "arcane_recovery", summaryRu: `Магическое восстановление: ${returned}` },
    occasion,
  );
}
