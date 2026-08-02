/**
 * Ручные правки ресурсов.
 *
 * Мастер вправе вернуть реакцию посреди раунда, а эффект предмета — потратить руну без заклинания.
 * Приложение не знает всех правил стола и не спорит: правка записывается в журнал и отменяется как
 * всё остальное.
 */

import { Character } from "@/core/domain/character/character";
import { commit, type Clock, type Session } from "@/core/application/session";

export function adjustRunes(session: Session, delta: number, clock: Clock): Session {
  const root = Character.of(session.character);
  const arcana = root.arcana.shiftRunes(delta);
  const remaining = arcana.runes.remaining;
  return commit(
    session,
    root.withArcana(arcana),
    {
      kind: "manual_adjustment",
      summaryRu: delta > 0 ? `Возвращена руна: ${remaining}` : `Потрачена руна: ${remaining}`,
    },
    clock,
  );
}

/**
 * Ручной учёт Костей хитов.
 *
 * Приложение их не бросает: бросок остаётся за столом. Лечение по ним считает другой путь —
 * заклинание, которое их тратит, лечит по введённому результату своим мастером применения.
 */
export function adjustHitDice(session: Session, delta: number, clock: Clock): Session {
  const root = Character.of(session.character);
  const vitality = root.vitality.shiftHitDice(delta);
  // Пул точно есть: сдвиг отказал бы раньше, если бы костей не было заведено.
  const remaining = vitality.hitDice!.remaining;
  return commit(
    session,
    root.withVitality(vitality),
    {
      kind: "manual_adjustment",
      summaryRu:
        delta > 0
          ? `Возвращена кость хитов: ${remaining}`
          : `Потрачена кость хитов: осталось ${remaining}`,
    },
    clock,
  );
}

/** Ручное списание ячейки: эффект предмета или чужое заклинание вне модели приложения. */
export function spendSpellSlot(session: Session, slotLevel: number, clock: Clock): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withArcana(root.arcana.spendSlot(slotLevel)),
    { kind: "slot_spent", summaryRu: `Списана ячейка ${slotLevel} уровня`, slotLevel },
    clock,
  );
}

/** Возврат ошибочно потраченной ячейки. */
export function refundSpellSlot(session: Session, slotLevel: number, clock: Clock): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withArcana(root.arcana.refundSlot(slotLevel)),
    { kind: "slot_refunded", summaryRu: `Возвращена ячейка ${slotLevel} уровня`, slotLevel },
    clock,
  );
}
