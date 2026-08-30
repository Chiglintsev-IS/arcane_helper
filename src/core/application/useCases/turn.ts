import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { Encounter, type TurnEconomy } from "@/core/domain/encounter/encounter";
import type { ActiveEffect } from "@/core/domain/effects/schema";
import { commit, type Occasion, type Session } from "@/core/application/session";

function encounterOf(session: Session): Encounter {
  return Encounter.fromLog(session.log);
}

export function expiryNotes(expired: readonly ActiveEffect[]): string[] {
  return expired.map((effect) => `«${effect.nameRu}» истёк`);
}

export function inFight(session: Session): boolean {
  return encounterOf(session).economy.inFight;
}

export function deriveTurnEconomy(session: Session): TurnEconomy {
  return encounterOf(session).economy;
}

export function startCombat(session: Session, occasion: Occasion): Session {
  return advanceTurn(session, occasion, "combat_started", "Бой начался");
}

export function beginTurn(session: Session, occasion: Occasion): Session {
  return advanceTurn(session, occasion, "turn_started", "Начало хода");
}

function advanceTurn(
  session: Session,
  occasion: Occasion,
  kind: "combat_started" | "turn_started",
  title: string,
): Session {
  const root = Character.of(session.character);
  const encounter = encounterOf(session);
  const measured = root.vitality.afterTurnStart();
  const healed = measured.regenerationDue(root.base.level);
  const { board, expired } = root.effects.expire((effect) => encounter.roundsSince(effect.startedAt));

  const after = root.withEffects(board).withVitality(measured.healUpTo(healed).vitality);

  const notes = [...(healed > 0 ? [`регенерация +${healed}`] : []), ...expiryNotes(expired)];
  return commit(
    session,
    after,
    { kind, summaryRu: notes.length === 0 ? title : `${title} · ${notes.join(", ")}` },
    occasion,
  );
}

export function combatEndRecovery(character: CharacterState): number {
  return Character.of(character).vitality.continuousRegenerationDue();
}

export function endCombat(session: Session, occasion: Occasion): Session {
  const root = Character.of(session.character);
  const { vitality, healed } = root.vitality.regeneratedContinuously();
  const { board, expired } = root.effects.afterCombat();
  const after = root.withEffects(board).withVitality(vitality);

  const notes = [
    ...(healed > 0 ? [`восстановлено ${healed} до половины максимума`] : []),
    ...expiryNotes(expired),
  ];
  return commit(
    session,
    after,
    {
      kind: "combat_ended",
      summaryRu: notes.length === 0 ? "Бой закончен" : `Бой закончен: ${notes.join(", ")}`,
    },
    occasion,
  );
}
