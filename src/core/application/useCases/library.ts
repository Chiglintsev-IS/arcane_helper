/**
 * Книга: подготовка, компоненты, заметки.
 */

import { Character } from "@/core/domain/assembly/character";
import type { Spell } from "@/core/domain/catalog/spell";
import { DomainError } from "@/core/domain/shared/errors";
import { materialOf } from "@/core/application/casting/material";
import { addItem, adjustBagCount } from "@/core/application/useCases/equipment";
import { commit, withoutRecord, type Occasion, type Session } from "@/core/application/session";

/**
 * Переключение подготовки заклинания.
 *
 * Лимит сценарий берёт у листа сам: он производное характеристики и уровня, и экран, передававший
 * его аргументом, решал за книгу, сколько ей можно.
 */
export function togglePreparation(session: Session, spell: Spell, occasion: Occasion): Session {
  const root = Character.of(session.character);
  const { spellbook, prepared } = root.spellbook.togglePreparation(
    spell.id,
    spell.nameRu,
    spell.level,
    Character.of(session.character).sheet.value("preparedLimit"),
  );
  return commit(
    session,
    root.withSpellbook(spellbook),
    {
      kind: "manual_adjustment",
      summaryRu: prepared ? `Подготовлено: ${spell.nameRu}` : `Снята подготовка: ${spell.nameRu}`,
      spellId: spell.id,
    },
    occasion,
  );
}

/**
 * Купить материальный компонент или потратить купленный.
 *
 * Компонент — вещь, поэтому и покупка его, и трата — обычные правки сумки: своих слов у них нет, и
 * второй способ положить вещь в сумку разошёлся бы с первым на первой же правке.
 */
export function toggleMaterial(session: Session, spell: Spell, occasion: Occasion): Session {
  const material = materialOf(spell.components);
  if (material === undefined) {
    throw new DomainError(`«${spell.nameRu}» материального компонента не требует`);
  }
  return Character.of(session.character).equipment.carries(material.id)
    ? adjustBagCount(session, material.id, -1, occasion)
    : addItem(session, material, occasion);
}

/**
 * Заметка игрока к заклинанию: место для домашних правил мастера.
 *
 * Игрового состояния не меняет, поэтому записи лога не создаёт и отмене не подлежит: лог —
 * механизм возврата ресурсов, а не история правок текста.
 */
export function setSpellNote(session: Session, spellId: string, note: string): Session {
  const root = Character.of(session.character);
  return withoutRecord(session, root.withSpellbook(root.spellbook.setNote(spellId, note)));
}
