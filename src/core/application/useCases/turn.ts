/**
 * Ход и схватка: начало боя, свой ход, конец боя.
 *
 * Начало хода — событие, на которое отзываются несколько доменов сразу: возвращаются ресурсы хода,
 * истекают раундовые эффекты, идёт регенерация, снимается подавление огнём. Поэтому оно живёт здесь,
 * а не внутри одного из агрегатов.
 */

import { Character } from "@/core/domain/character/character";
import type { CharacterState } from "@/core/domain/character/state";
import { Encounter, type TurnEconomy } from "@/core/domain/encounter/encounter";
import { commit, type Clock, type Session } from "@/core/application/session";

export type { TurnEconomy };

/**
 * Ведётся ли учёт хода. Ровно в режиме «Бой»: вне боя ходов нет, и считать нечего.
 *
 * Решение принимается здесь, а не в правилах: правило получает готовый признак и про экран не знает.
 */
export function turnTracked(character: CharacterState): boolean {
  return character.screenMode === "combat";
}

export function encounterOf(session: Session): Encounter {
  return Encounter.fromJournal(session.journal, turnTracked(session.character));
}

export function deriveTurnEconomy(session: Session): TurnEconomy {
  return encounterOf(session).economy;
}

/** Действует ли регенерация прямо сейчас и на сколько. */
export function regenerationDue(character: CharacterState): number {
  const root = Character.of(character);
  return root.vitality.regenerationDue(root.base.level);
}

/**
 * Начало боя: явная отметка, с которой считается первый раунд.
 *
 * Это и есть первый ход, поэтому вся работа начала хода выполняется здесь же. Без отметки
 * приложение не знает, где кончился прежний бой, и следующий начинается с шестого раунда.
 */
export function startCombat(session: Session, clock: Clock): Session {
  return advanceTurn(session, clock, "combat_started", "Бой начался");
}

export function beginTurn(session: Session, clock: Clock): Session {
  return advanceTurn(session, clock, "turn_started", "Начало хода");
}

function advanceTurn(
  session: Session,
  clock: Clock,
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

  const restored: CharacterState = {
    ...after.toState(),
    reactionAvailable: true,
    turnTracking: { actionAvailable: true, bonusActionAvailable: true },
  };

  const notes = [
    ...(healed > 0 ? [`регенерация +${healed}`] : []),
    ...expired.map((effect) => `«${effect.nameRu}» истёк`),
  ];
  return commit(
    session,
    restored,
    { kind, summaryRu: notes.length === 0 ? title : `${title} · ${notes.join(", ")}` },
    clock,
  );
}

/** Сколько здоровья вернёт конец боя. Ноль — восстанавливать нечего. */
export function combatEndRecovery(character: CharacterState): number {
  return Character.of(character).vitality.combatEndRecovery();
}

/**
 * Конец боя: отметка о факте, а восстановление тролля — её следствие.
 *
 * Запись появляется всегда, даже когда лечить нечего: от неё считаются раунды следующего боя.
 */
export function endCombat(session: Session, clock: Clock): Session {
  const root = Character.of(session.character);
  const restored = root.vitality.combatEndRecovery();
  const after = root.withVitality(root.vitality.healUpTo(restored).vitality);
  return commit(
    session,
    after,
    {
      kind: "combat_ended",
      summaryRu:
        restored === 0
          ? "Бой закончен"
          : `Бой закончен: восстановлено ${restored} до половины максимума`,
    },
    clock,
  );
}
