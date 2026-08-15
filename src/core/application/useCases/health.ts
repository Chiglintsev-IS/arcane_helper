/**
 * Здоровье: урон, лечение, временные хиты, обмен крови на очки заклинаний, подавление.
 *
 * Проверку концентрации приложение здесь не запускает: сложность оно называет, а бросает игрок.
 */

import { Character } from "@/core/domain/assembly/character";
import { DomainError } from "@/core/domain/shared/errors";
import { hitPointsForPoints } from "@/core/domain/arcana/slots";
import { commit, type Occasion, type Session } from "@/core/application/session";
import { inFight } from "./turn";

/** Полученный урон. Огненный урон подавляет расовые особенности. */
export function takeDamage(
  session: Session,
  damage: number,
  occasion: Occasion,
  options: { fire?: boolean } = {},
): Session {
  const root = Character.of(session.character);
  const { vitality, absorbed } = root.vitality.takeDamage(damage, options);
  const note = options.fire === true ? " (огонь: особенности подавлены)" : "";
  const absorbedNote = absorbed > 0 ? `, из них ${absorbed} временными хитами` : "";
  return commit(
    session,
    root.withVitality(vitality),
    {
      kind: "hit_points_changed",
      summaryRu: `Получено урона: ${damage}${absorbedNote}${note}`,
      damage,
    },
    occasion,
  );
}

export function heal(session: Session, amount: number, occasion: Occasion): Session {
  const root = Character.of(session.character);
  const { vitality, restored } = root.vitality.heal(amount);
  const note = restored < amount ? ` (из ${amount}: упёрлись в максимум)` : "";
  return commit(
    session,
    root.withVitality(vitality),
    { kind: "hit_points_changed", summaryRu: `Вылечено: ${restored}${note}` },
    occasion,
  );
}

/** Ручное начисление временных хитов. */
export function grantTemporaryHitPoints(session: Session, amount: number, occasion: Occasion): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withVitality(root.vitality.grantTemporaryExplicitly(amount)),
    { kind: "hit_points_changed", summaryRu: `Временные хиты: ${amount}` },
    occasion,
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
  occasion: Occasion,
  options: { allowAnyway?: boolean } = {},
): Session {
  const root = Character.of(session.character);
  const hitPoints = hitPointsForPoints(spellPoints, root.base.level);
  const { vitality, exchange } = root.vitality.exchangeBlood(hitPoints, spellPoints, options);
  const withPoints = root
    .withVitality(vitality)
    .withArcana(root.arcana.gainSpellPoints(exchange.pointsCreated));

  return commit(
    session,
    withPoints,
    {
      kind: "blood_exchange",
      summaryRu: `Кровавое колдовство: ${exchange.hitPointsSpent} хитов → ${exchange.pointsCreated} очков`,
      actionUsed: "action",
    },
    occasion,
  );
}

/**
 * Что долечила регенерация. Строка одна на все отрезки времени, за которые она идёт: назвать её
 * дважды значило бы получить два разных слова об одном и том же росте хитов.
 */
export function regenerationNote(healed: number): string[] {
  return healed > 0 ? [`регенерация +${healed}`] : [];
}

/**
 * Строки журнала одного часа: что вернулось максимуму, что долечила регенерация, что погашено
 * очками заклинаний. Последние два — следствия именно часа, и короче часа за ними не идут.
 */
function hourNotes(returned: number, healed: number, hadSpellPoints: boolean): string[] {
  return [
    ...(returned > 0 ? [`максимум +${returned}`] : []),
    ...regenerationNote(healed),
    ...(hadSpellPoints ? ["очки заклинаний погашены"] : []),
  ];
}

/**
 * Почему час сейчас не проходит; `null` — проходит.
 *
 * Спрашивают её и до нажатия, и при нём: погашенная кнопка называет ровно ту причину, которой
 * ответил бы отказ. Того, что часу нечего менять, здесь нет: это видно по числам самого часа.
 */
export function hourUnavailability(session: Session): string | null {
  return inFight(session) ? IN_FIGHT_HOUR_REASON : null;
}

const IN_FIGHT_HOUR_REASON = "Пока идёт бой, час пройти не может";

/**
 * Почасовое восстановление максимума хитов и погашение очков заклинаний. Час отмечает игрок:
 * таймеров в приложении нет, а внутри боевого раунда часа не бывает.
 *
 * Очки заклинаний гаснут любым отмеченным часом независимо от подавления: оно решает только за
 * восстановление максимума и регенерацию, а очки истекают сами по себе.
 */
export function recoverHitPointMaximum(session: Session, occasion: Occasion): Session {
  const unavailability = hourUnavailability(session);
  if (unavailability !== null) {
    throw new DomainError(unavailability);
  }
  const root = Character.of(session.character);
  const hadSpellPoints = root.arcana.spellPoints > 0;
  const { vitality, returned, healed } = root.vitality.afterAnHour(root.base.level);

  if (returned <= 0 && healed <= 0 && !hadSpellPoints) {
    if (root.vitality.suppressed && root.vitality.bloodReduction > 0) {
      throw new DomainError(
        root.vitality.firedUpon
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
    occasion,
  );
}

/** Признак прямого солнечного света переключается вручную. */
export function setSunlight(session: Session, underSunlight: boolean, occasion: Occasion): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withVitality(root.vitality.setSunlight(underSunlight)),
    {
      kind: "suppression_changed",
      summaryRu: underSunlight ? "Под прямым солнечным светом" : "Вне солнечного света",
    },
    occasion,
  );
}
