/**
 * Ручные правки ресурсов.
 *
 * Мастер вправе вернуть реакцию посреди раунда, а эффект предмета — потратить руну без заклинания.
 * Приложение не знает всех правил стола и не спорит: правка записывается в журнал и отменяется как
 * всё остальное.
 */

import { Character } from "@/core/domain/assembly/character";
import { commit, type Occasion, type Session } from "@/core/application/session";

export function adjustRunes(session: Session, delta: number, occasion: Occasion): Session {
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
    occasion,
  );
}

/**
 * Последняя подсказка: одно применение до долгого отдыха.
 *
 * Приложение не знает ни повода, ни броска — оно ведёт запас, и потому единственный способ его
 * тронуть тот же, что у руны: рукой игрока и записью в журнале.
 */
export function adjustLastHint(session: Session, delta: number, occasion: Occasion): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withArcana(root.arcana.shiftLastHint(delta)),
    {
      kind: "manual_adjustment",
      summaryRu: delta > 0 ? "Возвращена подсказка" : "Потрачена подсказка",
    },
    occasion,
  );
}

/** Ручное списание ячейки: эффект предмета или чужое заклинание вне модели приложения. */
export function spendSpellSlot(session: Session, slotLevel: number, occasion: Occasion): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withArcana(root.arcana.spendSlot(slotLevel)),
    { kind: "slot_spent", summaryRu: `Списана ячейка ${slotLevel} уровня`, slotLevel },
    occasion,
  );
}

/** Возврат ошибочно потраченной ячейки. */
export function refundSpellSlot(session: Session, slotLevel: number, occasion: Occasion): Session {
  const root = Character.of(session.character);
  return commit(
    session,
    root.withArcana(root.arcana.refundSlot(slotLevel)),
    { kind: "slot_refunded", summaryRu: `Возвращена ячейка ${slotLevel} уровня`, slotLevel },
    occasion,
  );
}
