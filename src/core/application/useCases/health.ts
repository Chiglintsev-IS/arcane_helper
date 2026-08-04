/**
 * Здоровье: урон, лечение, временные хиты, обмен крови на очки заклинаний, подавление.
 *
 * Проверку концентрации приложение здесь не запускает: сложность оно называет, а бросает игрок.
 */

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { DomainError } from "@/core/domain/shared/errors";
import { hitPointCost, hitPointsForPoints } from "@/core/domain/arcana/slots";
import { commit, type Clock, type Session } from "@/core/application/session";
import { inFight } from "./turn";

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
 * Обмен хитов на очки заклинаний. Принимает количество очков; количество хитов вычисляется
 * внутри по курсу ступени возвышения персонажа.
 * Потеря хитов уроном не считается и проверку концентрации не порождает.
 */
export function exchangeBlood(
  session: Session,
  spellPoints: number,
  clock: Clock,
  options: { allowAnyway?: boolean } = {},
): Session {
  const root = Character.of(session.character);
  const hitPoints = hitPointsForPoints(spellPoints, root.base.level);
  const { vitality, exchange } = root.vitality.exchangeBlood(hitPoints, spellPoints, options);
  const withPoints = root
    .withVitality(vitality)
    .withArcana(root.arcana.gainSpellPoints(exchange.pointsCreated));

  const after: CharacterState = {
    ...withPoints.toState(),
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
 * Строки журнала одного часа: что вернулось максимуму, что долечила регенерация, что погашено
 * очками заклинаний. Общие для отдельной отметки часа и короткого отдыха — короткий отдых им и
 * является.
 */
export function hourNotes(returned: number, healed: number, hadSpellPoints: boolean): string[] {
  return [
    ...(returned > 0 ? [`максимум +${returned}`] : []),
    ...(healed > 0 ? [`регенерация +${healed}`] : []),
    ...(hadSpellPoints ? ["очки заклинаний погашены"] : []),
  ];
}

/**
 * Почасовое восстановление максимума хитов и погашение очков заклинаний. Час отмечает игрок:
 * таймеров в приложении нет, а внутри боевого раунда часа не бывает.
 *
 * Очки заклинаний гаснут любым отмеченным часом независимо от подавления: оно решает только за
 * восстановление максимума и регенерацию, а очки истекают сами по себе.
 */
export function recoverHitPointMaximum(session: Session, clock: Clock): Session {
  if (inFight(session)) {
    throw new DomainError("Пока идёт бой, час пройти не может");
  }
  const root = Character.of(session.character);
  const hadSpellPoints = root.arcana.spellPoints > 0;
  const { vitality, returned, healed } = root.vitality.afterAnHour(root.base.level);

  if (returned <= 0 && healed <= 0 && !hadSpellPoints) {
    if (root.vitality.suppressed && root.vitality.bloodReduction > 0) {
      throw new DomainError(
        session.character.suppression.firedUpon
          ? "Урон огнём подавил особенности: максимум пока не восстанавливается"
          : "Под прямым солнечным светом особенности не действуют",
      );
    }
    throw new DomainError("Восстанавливать максимум и гасить очки заклинаний нечего");
  }

  const after = root.withVitality(vitality).withArcana(root.arcana.expireSpellPoints());
  return commit(
    session,
    after,
    {
      kind: "hit_points_changed",
      summaryRu: `Прошёл час: ${hourNotes(returned, healed, hadSpellPoints).join(", ")}`,
    },
    clock,
  );
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
