/**
 * Отдых: короткий, долгий и магическое восстановление.
 *
 * Отдых задевает сразу несколько объектов-значений и потому живёт сценарием: ресурсы возвращаются, эффекты
 * короче отдыха закрываются, здоровье поднимается, снижённый максимум тает по часам.
 *
 * Ни одна из трёх операций не идёт во время боя: экран режима «Привал» доступен и в бою — переход
 * в него не спрашивает про схватку, — а отказ обязан жить в сценарии, а не только в кнопке, которую
 * можно и не увидеть.
 */

import { Character } from "@/core/domain/assembly/character";
import type { SlotRecoveryPlan } from "@/core/domain/arcana/slots";
import { DomainError } from "@/core/domain/shared/errors";
import { LONG_REST_HOURS, maximumReductionAfterHours } from "@/core/domain/vitality/blood";
import { hitDiceRegainedOnLongRest } from "@/core/domain/vitality/hitDice";
import { SHORT_REST_DURATION_RU } from "@/core/domain/vitality/shortRest";
import { commit, type Occasion, type Session } from "@/core/application/session";
import { regenerationNote } from "./health";
import { inFight } from "./turn";

/**
 * Долгий отдых. Восстанавливает всё, включая руны и здоровье, и снимает концентрацию.
 *
 * Снижённый кровавым колдовством максимум возвращается не махом, а восемью часами почасового
 * правила: остаток переходит на следующий день. Текущие хиты поднимаются уже до нового максимума —
 * иначе персонаж вышел бы из отдыха с недобором, не видным ни на одном экране.
 */
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
    // Половина костей, округляя вниз. Персонажу без костей отдых их не выдумывает.
    .restoreHitDice(dice === undefined ? 0 : hitDiceRegainedOnLongRest(dice.total));

  const after = root
    .withVitality(vitality)
    .withArcana(root.arcana.restoredByLongRest())
    .withEffects(root.effects.afterLongRest());

  return commit(session, after, { kind: "long_rest", summaryRu: "Долгий отдых" }, occasion);
}

/**
 * Короткий отдых. Ячеек сам по себе не восстанавливает.
 *
 * Часом он не является, поэтому следствий часа за собой не ведёт: снижённый кровавым колдовством
 * максимум остаётся на месте, накопленные очки заклинаний доживают до отметки часа. Регенерация за
 * это время до половины доходит — вне схватки она идёт непрерывно и отдыха не ждёт.
 */
export function shortRest(session: Session, occasion: Occasion): Session {
  const unavailability = shortRestUnavailability(session);
  if (unavailability !== null) {
    throw new DomainError(unavailability);
  }
  const root = Character.of(session.character);
  const { vitality, healed } = root.vitality.regeneratedByShortRest();

  const after = root
    .withVitality(vitality.clearFireSuppression())
    .withArcana(root.arcana.markShortRest());

  const notes = regenerationNote(healed);
  return commit(
    session,
    after,
    {
      kind: "short_rest",
      summaryRu: notes.length === 0 ? "Короткий отдых" : `Короткий отдых · ${notes.join(", ")}`,
    },
    occasion,
  );
}

/**
 * Почему операция привала сейчас не идёт; `null` — идёт.
 *
 * Спрашивают их дважды: до нажатия — чтобы погасить кнопку и назвать причину, и при нажатии —
 * чтобы отказать. Ответ обязан быть один: две формулировки одного запрета расходятся на первой же
 * правке, и молча.
 *
 * Бой перекрывает собственные причины магического восстановления: пока он идёт, «берётся после
 * короткого отдыха» бессмысленно — короткого отдыха сейчас тоже нет.
 */
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

/** Магическое восстановление. Дневной бюджет уровней ячеек можно брать частями. */
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
