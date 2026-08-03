/**
 * Книга: подготовка, компоненты, заметки.
 */

import { Character } from "@/core/domain/character/character";
import type { Spell } from "@/core/domain/catalog/spell";
import { commit, withoutRecord, type Clock, type Session } from "@/core/application/session";

/** Переключение подготовки заклинания. */
export function togglePreparation(
  session: Session,
  spell: Spell,
  limit: number,
  clock: Clock,
): Session {
  const root = Character.of(session.character);
  const { spellbook, prepared } = root.spellbook.togglePreparation(
    spell.id,
    spell.nameRu,
    spell.level,
    limit,
  );
  return commit(
    session,
    root.withSpellbook(spellbook),
    {
      kind: "manual_adjustment",
      summaryRu: prepared ? `Подготовлено: ${spell.nameRu}` : `Снята подготовка: ${spell.nameRu}`,
      spellId: spell.id,
    },
    clock,
  );
}

/**
 * Отметить дорогой компонент купленным или потраченным.
 *
 * Списка предметов у приложения нет: есть ровно то, что нужно проверке доступности, — лежит ли в
 * сумке компонент конкретного заклинания.
 */
export function toggleMaterial(session: Session, spellId: string, clock: Clock): Session {
  const root = Character.of(session.character);
  const { equipment, owned } = root.equipment.toggleMaterial(spellId);
  return commit(
    session,
    root.withEquipment(equipment),
    {
      kind: "manual_adjustment",
      summaryRu: owned ? `Компонент куплен: ${spellId}` : `Компонент израсходован: ${spellId}`,
      spellId,
    },
    clock,
  );
}

/**
 * Заметка игрока к заклинанию: место для домашних правил мастера.
 *
 * Игрового состояния не меняет, поэтому записи журнала не создаёт и отмене не подлежит: журнал —
 * механизм возврата ресурсов, а не история правок текста.
 */
export function setSpellNote(session: Session, spellId: string, note: string): Session {
  const root = Character.of(session.character);
  return withoutRecord(session, root.withSpellbook(root.spellbook.setNote(spellId, note)));
}
