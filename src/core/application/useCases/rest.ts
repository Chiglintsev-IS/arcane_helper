/**
 * Отдых: короткий, долгий и магическое восстановление.
 *
 * Отдых задевает сразу несколько агрегатов и потому живёт сценарием: ресурсы возвращаются, эффекты
 * короче отдыха закрываются, здоровье поднимается, снижённый максимум тает по часам.
 */

import { Character } from "@/core/domain/character/character";
import type { CharacterState } from "@/core/domain/character/state";
import type { SlotRecoveryPlan } from "@/core/domain/arcana/slots";
import { LONG_REST_HOURS, maximumReductionAfterHours } from "@/core/domain/vitality/blood";
import { hitDiceRegainedOnLongRest } from "@/core/domain/vitality/hitDice";
import { commit, type Clock, type Session } from "@/core/application/session";
import { hourNotes } from "./health";

/**
 * Долгий отдых. Восстанавливает всё, включая руны и здоровье, и снимает концентрацию.
 *
 * Снижённый кровавым колдовством максимум возвращается не махом, а восемью часами почасового
 * правила: остаток переходит на следующий день. Текущие хиты поднимаются уже до нового максимума —
 * иначе персонаж вышел бы из отдыха с недобором, не видным ни на одном экране.
 */
export function longRest(session: Session, clock: Clock): Session {
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
    // Половина костей, округляя вниз. Персонажу без костей отдых их не выдумывает.
    .restoreHitDice(dice === undefined ? 0 : hitDiceRegainedOnLongRest(dice.total));

  const after: CharacterState = {
    ...root
      .withVitality(vitality)
      .withArcana(root.arcana.restoredByLongRest())
      .withEffects(root.effects.afterLongRest())
      .toState(),
    reactionAvailable: true,
    // Долгий отдых обнуляет отметку: следующее восстановление снова ждёт короткого отдыха.
    shortRestSinceLongRest: false,
    turnTracking: { actionAvailable: true, bonusActionAvailable: true },
  };

  return commit(session, after, { kind: "long_rest", summaryRu: "Долгий отдых" }, clock);
}

/**
 * Короткий отдых. Ячеек сам по себе не восстанавливает.
 *
 * Короткий отдых — это час, и час делает всё, что делает час: возвращает ступень снижённого
 * максимума, даёт регенерации дойти до половины и гасит очки заклинаний. Отдельная кнопка «Прошёл
 * час» рядом с ним не должна значить больше, чем сам отдых.
 */
export function shortRest(session: Session, clock: Clock): Session {
  const root = Character.of(session.character);
  const { vitality, returned, healed } = root.vitality.afterAnHour(root.base.level);
  const hadSpellPoints = root.arcana.spellPoints > 0;

  const after: CharacterState = {
    ...root
      .withVitality(vitality.clearFireSuppression())
      .withArcana(root.arcana.expireSpellPoints())
      .toState(),
    reactionAvailable: true,
    // Отметка нужна интерфейсу: сама операция восстановления её не проверяет — отдых мог случиться
    // за столом без нажатия кнопки.
    shortRestSinceLongRest: true,
    turnTracking: { actionAvailable: true, bonusActionAvailable: true },
  };

  const notes = hourNotes(returned, healed, hadSpellPoints);
  return commit(
    session,
    after,
    {
      kind: "short_rest",
      summaryRu: notes.length === 0 ? "Короткий отдых" : `Короткий отдых · ${notes.join(", ")}`,
    },
    clock,
  );
}

/** Магическое восстановление. Один раз между долгими отдыхами. */
export function useArcaneRecovery(
  session: Session,
  plan: SlotRecoveryPlan,
  clock: Clock,
): Session {
  const root = Character.of(session.character);
  const after = root.withArcana(root.arcana.useArcaneRecovery(plan, root.base.level));
  const returned = Object.entries(plan)
    .filter(([, count]) => count > 0)
    .map(([level, count]) => `${count}×${level} ур.`)
    .join(", ");
  return commit(
    session,
    after,
    { kind: "arcane_recovery", summaryRu: `Магическое восстановление: ${returned}` },
    clock,
  );
}
