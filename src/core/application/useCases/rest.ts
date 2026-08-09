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
import type { CharacterState } from "@/core/domain/assembly/state";
import type { SlotRecoveryPlan } from "@/core/domain/arcana/slots";
import { DomainError } from "@/core/domain/shared/errors";
import { LONG_REST_HOURS, maximumReductionAfterHours } from "@/core/domain/vitality/blood";
import { hitDiceRegainedOnLongRest } from "@/core/domain/vitality/hitDice";
import { commit, type Occasion, type Session } from "@/core/application/session";
import { hourNotes } from "./health";
import { inFight } from "./turn";

/**
 * Долгий отдых. Восстанавливает всё, включая руны и здоровье, и снимает концентрацию.
 *
 * Снижённый кровавым колдовством максимум возвращается не махом, а восемью часами почасового
 * правила: остаток переходит на следующий день. Текущие хиты поднимаются уже до нового максимума —
 * иначе персонаж вышел бы из отдыха с недобором, не видным ни на одном экране.
 */
export function longRest(session: Session, occasion: Occasion): Session {
  if (inFight(session)) {
    throw new DomainError("Пока идёт бой, долгий отдых недоступен");
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
 * Короткий отдых — это час, и час делает всё, что делает час: возвращает ступень снижённого
 * максимума, даёт регенерации дойти до половины и гасит очки заклинаний. Отдельная кнопка «Прошёл
 * час» рядом с ним не должна значить больше, чем сам отдых.
 */
export function shortRest(session: Session, occasion: Occasion): Session {
  if (inFight(session)) {
    throw new DomainError("Пока идёт бой, короткий отдых недоступен");
  }
  const root = Character.of(session.character);
  const { vitality, returned, healed } = root.vitality.afterAnHour(root.base.level);
  const hadSpellPoints = root.arcana.spellPoints > 0;

  const after = root
    .withVitality(vitality.clearFireSuppression())
    .withArcana(root.arcana.expireSpellPoints().markShortRest());

  const notes = hourNotes(returned, healed, hadSpellPoints);
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
 * Почему «Магическое восстановление» сейчас не берётся, кроме боя; `null` — берётся.
 *
 * Экран спрашивает ту же причину, которой откажет само применение, а не пересказывает правило:
 * погашенная кнопка обязана называть ровно то, чем ответил бы отказ.
 */
export function arcaneRecoveryUnavailability(character: CharacterState): string | null {
  return Character.of(character).arcana.arcaneRecoveryUnavailability();
}

/** Магическое восстановление. Дневной бюджет уровней ячеек можно брать частями. */
export function useArcaneRecovery(
  session: Session,
  plan: SlotRecoveryPlan,
  occasion: Occasion,
): Session {
  if (inFight(session)) {
    throw new DomainError("Пока идёт бой, магическое восстановление недоступно");
  }
  const unavailability = arcaneRecoveryUnavailability(session.character);
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
