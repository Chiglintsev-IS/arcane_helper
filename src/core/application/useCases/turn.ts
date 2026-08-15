/**
 * Ход и схватка: начало боя, свой ход, конец боя.
 *
 * Начало хода — событие, на которое отзываются несколько доменов сразу: возвращаются ресурсы хода,
 * истекают раундовые эффекты, идёт регенерация, снимается подавление огнём. Поэтому оно живёт здесь,
 * а не внутри одного из объектов-значений.
 */

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { Encounter, type TurnEconomy } from "@/core/domain/encounter/encounter";
import type { ActiveEffect } from "@/core/domain/effects/schema";
import { commit, type Occasion, type Session } from "@/core/application/session";


function encounterOf(session: Session): Encounter {
  return Encounter.fromJournal(session.journal);
}

function expiryNotes(expired: readonly ActiveEffect[]): string[] {
  return expired.map((effect) => `«${effect.nameRu}» истёк`);
}

/** Идёт ли бой прямо сейчас. Ответ один на всё приложение, и он выводится из журнала. */
export function inFight(session: Session): boolean {
  return encounterOf(session).economy.inFight;
}

export function deriveTurnEconomy(session: Session): TurnEconomy {
  return encounterOf(session).economy;
}

/**
 * Начало боя: явная отметка, с которой считается первый раунд.
 *
 * Это и есть первый ход, поэтому вся работа начала хода выполняется здесь же. Без отметки
 * приложение не знает, где кончился прежний бой, и следующий начинается с шестого раунда.
 */
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
  const healed = root.vitality.regenerationDue(root.base.level);
  const { board, expired } = root.effects.expire((effect) => encounter.roundsSince(effect.startedAt));

  const after = root
    .withEffects(board)
    .withVitality(root.vitality.clearFireSuppression().healUpTo(healed).vitality);

  const notes = [...(healed > 0 ? [`регенерация +${healed}`] : []), ...expiryNotes(expired)];
  return commit(
    session,
    after,
    { kind, summaryRu: notes.length === 0 ? title : `${title} · ${notes.join(", ")}` },
    occasion,
  );
}

/** Сколько здоровья вернёт конец боя. Ноль — восстанавливать нечего. */
export function combatEndRecovery(character: CharacterState): number {
  return Character.of(character).vitality.combatEndRecovery();
}

/**
 * Конец боя: отметка о факте, а восстановление тролля и истечение раундового — её следствия.
 *
 * Запись появляется всегда, даже когда лечить нечего: от неё считаются раунды следующего боя.
 */
export function endCombat(session: Session, occasion: Occasion): Session {
  const root = Character.of(session.character);
  const restored = root.vitality.combatEndRecovery();
  const { board, expired } = root.effects.afterCombat();
  const after = root.withEffects(board).withVitality(root.vitality.healUpTo(restored).vitality);

  const notes = [
    ...(restored > 0 ? [`восстановлено ${restored} до половины максимума`] : []),
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
