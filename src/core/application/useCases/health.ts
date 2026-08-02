/**
 * Здоровье: урон, лечение, временные хиты, обмен крови на очки заклинаний, подавление.
 *
 * Проверку концентрации приложение здесь не запускает: сложность оно называет, а бросает игрок.
 */

import { Character } from "@/core/domain/character/character";
import type { CharacterState } from "@/core/domain/character/state";
import { DomainError } from "@/core/domain/shared/errors";
import { hitPointCost } from "@/core/domain/vitality/blood";
import { commit, type Clock, type Session } from "@/core/application/session";
import { turnTracked } from "./turn";

/** Полученный урон. Огненный урон подавляет расовые особенности. */
export function takeDamage(
  session: Session,
  damage: number,
  clock: Clock,
  options: { fire?: boolean } = {},
): Session {
  const root = Character.of(session.character);
  const { vitality, absorbed } = root.vitality.takeDamage(damage, options);
  const note = options.fire === true ? " (огонь: особенности подавлены)" : "";
  const absorbedNote = absorbed > 0 ? `, из них ${absorbed} временными хитами` : "";
  return commit(
    session,
    root.withVitality(vitality),
    { kind: "hit_points_changed", summaryRu: `Получено урона: ${damage}${absorbedNote}${note}` },
    clock,
  );
}

export function heal(session: Session, amount: number, clock: Clock): Session {
  const root = Character.of(session.character);
  const { vitality, restored } = root.vitality.heal(amount);
  const note = restored < amount ? ` (из ${amount}: упёрлись в максимум)` : "";
  return commit(
    session,
    root.withVitality(vitality),
    { kind: "hit_points_changed", summaryRu: `Вылечено: ${restored}${note}` },
    clock,
  );
}

/** Ручное начисление временных хитов. */
export function grantTemporaryHitPoints(session: Session, amount: number, clock: Clock): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withVitality(root.vitality.grantTemporaryExplicitly(amount)),
    { kind: "hit_points_changed", summaryRu: `Временные хиты: ${amount}` },
    clock,
  );
}

/**
 * Обмен хитов на очки заклинаний. Действие в свой ход; потеря хитов уроном не считается и проверку
 * концентрации не порождает — этот сценарий её и не запускает.
 */
export function exchangeBlood(
  session: Session,
  hitPoints: number,
  clock: Clock,
  options: { allowAnyway?: boolean } = {},
): Session {
  const root = Character.of(session.character);
  const { vitality, exchange } = root.vitality.exchangeBlood(hitPoints, root.base.level, options);
  const withPoints = root
    .withVitality(vitality)
    .withArcana(root.arcana.gainSpellPoints(exchange.pointsCreated, clock.now()));

  const after: CharacterState = {
    ...withPoints.toState(),
    ...(turnTracked(session.character)
      ? { turnTracking: { ...session.character.turnTracking, actionAvailable: false } }
      : {}),
  };

  return commit(
    session,
    after,
    {
      kind: "blood_exchange",
      summaryRu: `Кровавое колдовство: ${exchange.hitPointsSpent} хитов → ${exchange.pointsCreated} очков`,
      actionUsed: "action",
    },
    clock,
  );
}

/**
 * Почасовое восстановление максимума хитов. Час отмечает игрок: таймеров в приложении нет.
 *
 * Текущие хиты растут не сами по себе, а регенерацией, которая за час успевает дойти до половины.
 */
export function recoverHitPointMaximum(session: Session, clock: Clock): Session {
  const root = Character.of(session.character);
  if (root.vitality.bloodReduction <= 0) {
    throw new DomainError("Максимум хитов не снижен: восстанавливать нечего");
  }
  if (root.vitality.suppressed) {
    throw new DomainError(
      session.character.suppression.firedUpon
        ? "Урон огнём подавил особенности: максимум пока не восстанавливается"
        : "Под прямым солнечным светом особенности не действуют",
    );
  }
  const { vitality, returned, healed } = root.vitality.afterAnHour(root.base.level);
  return commit(
    session,
    root.withVitality(vitality),
    {
      kind: "hit_points_changed",
      summaryRu:
        healed > 0
          ? `Прошёл час: максимум +${returned}, регенерация +${healed}`
          : `Прошёл час: максимум хитов восстановлен на ${returned}`,
    },
    clock,
  );
}

/** Сколько хитов стоит заклинание указанного уровня для этого персонажа. */
export function bloodCostFor(character: CharacterState, spellLevel: number): number {
  return hitPointCost(spellLevel, character.level);
}

/** Признак прямого солнечного света переключается вручную. */
export function setSunlight(session: Session, underSunlight: boolean, clock: Clock): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withVitality(root.vitality.setSunlight(underSunlight)),
    {
      kind: "suppression_changed",
      summaryRu: underSunlight ? "Под прямым солнечным светом" : "Вне солнечного света",
    },
    clock,
  );
}
