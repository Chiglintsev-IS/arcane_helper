/**
 * Книга заклинаний: что персонаж знает, что подготовил и чем располагает из компонентов.
 *
 * Сюда же входят пометки игрока — заметки к заклинаниям и предпочтения отыгрыша: они привязаны к
 * записи книги и живут ровно столько же.
 *
 * Про ячейки, снаряжение и ход книга не знает: она отвечает на вопрос «что я умею», а не «чем я это
 * оплачу». Сводит их сотворение.
 */

import { ownedFields } from "@/core/domain/shared/ownedFields";
import { DomainError } from "@/core/domain/shared/errors";
import { CANTRIP_LEVEL } from "@/core/domain/catalog/spell";
import type { RoleplayPreference, SpellbookState } from "./schema";

export type { SpellbookState };

/** Пустые предпочтения: запись заводится, только когда игрок что-то пометил. */
const NO_PREFERENCES: RoleplayPreference = {
  favoriteVariantIds: [],
  disabledVariantIds: [],
  customVariants: [],
  usageCount: {},
};

function isEmptyPreference(preference: RoleplayPreference): boolean {
  return (
    preference.favoriteVariantIds.length === 0 &&
    preference.disabledVariantIds.length === 0 &&
    preference.customVariants.length === 0 &&
    Object.keys(preference.usageCount).length === 0
  );
}

export class Spellbook {
  private constructor(private readonly state: SpellbookState) {}

  /** Владеет только своими полями: иначе агрегат затирал бы правки соседа. */
  private static readonly KEYS = [
    "cantripIds",
    "spellbookSpellIds",
    "preparedSpellIds",
    "spellNotes",
    "roleplayPreferences",
  ] as const satisfies readonly (keyof SpellbookState)[];

  static of(state: SpellbookState): Spellbook {
    return new Spellbook(ownedFields(state, Spellbook.KEYS));
  }

  private with(change: Partial<SpellbookState>): Spellbook {
    return new Spellbook({ ...this.state, ...change });
  }

  knows(spellId: string, level: number): boolean {
    return level === CANTRIP_LEVEL
      ? this.state.cantripIds.includes(spellId)
      : this.state.spellbookSpellIds.includes(spellId);
  }

  isPrepared(spellId: string): boolean {
    return this.state.preparedSpellIds.includes(spellId);
  }

  /**
   * Лимит подготовки — единственное жёсткое ограничение приложения: двенадцатого заклинания нет в
   * правилах, и мастер здесь исключений не делает. Всё остальное предупреждает, но пускает.
   */
  togglePreparation(
    spellId: string,
    spellNameRu: string,
    level: number,
    limit: number,
  ): { spellbook: Spellbook; prepared: boolean } {
    if (level === CANTRIP_LEVEL) {
      throw new DomainError("Заговор не готовится: он доступен всегда");
    }
    if (!this.state.spellbookSpellIds.includes(spellId)) {
      throw new DomainError(`«${spellNameRu}» нет в книге заклинаний`);
    }

    const wasPrepared = this.isPrepared(spellId);
    if (!wasPrepared && this.state.preparedSpellIds.length >= limit) {
      throw new DomainError(
        `Подготовлено ${this.state.preparedSpellIds.length} из ${limit}: сначала снимите другое заклинание`,
      );
    }

    return {
      spellbook: this.with({
        preparedSpellIds: wasPrepared
          ? this.state.preparedSpellIds.filter((id) => id !== spellId)
          : [...this.state.preparedSpellIds, spellId],
      }),
      prepared: !wasPrepared,
    };
  }

  /** Заметка из одних пробелов удаляется: пустая строка не проходит схему состояния. */
  setNote(spellId: string, note: string): Spellbook {
    const { [spellId]: _replaced, ...rest } = this.state.spellNotes;
    return this.with({ spellNotes: note.trim() === "" ? rest : { ...rest, [spellId]: note } });
  }

  preferencesFor(spellId: string): RoleplayPreference {
    return this.state.roleplayPreferences[spellId] ?? NO_PREFERENCES;
  }

  /** Запись без единой пометки удаляется целиком: пустая структура осталась бы мусором в выгрузке. */
  changePreferences(
    spellId: string,
    change: (current: RoleplayPreference) => RoleplayPreference,
  ): Spellbook {
    const next = change(this.preferencesFor(spellId));
    const { [spellId]: _replaced, ...rest } = this.state.roleplayPreferences;
    return this.with({
      roleplayPreferences: isEmptyPreference(next) ? rest : { ...rest, [spellId]: next },
    });
  }

  toState(): SpellbookState {
    return this.state;
  }
}
