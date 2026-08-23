/**
 * Заметки: что игрок записал о мире своими словами.
 *
 * Отдельно от лога изменений намеренно: лог живёт ради возврата потраченного, ограничен
 * глубиной и вытесняет старое, а записанное словами не возвращают — его перечитывают через три
 * сессии. Ни одно правило игры отсюда не считается, и ни один контекст сюда не смотрит.
 */

import { DomainError } from "@/core/domain/shared/errors";
import { ownedFields } from "@/core/domain/shared/ownedFields";
import { worldNoteOf } from "./schema";
import type { WorldNote } from "./schema";

type NotesState = { worldNotes: readonly WorldNote[] };

export class Notes {
  private static readonly KEYS = ["worldNotes"] as const satisfies readonly (keyof NotesState)[];

  private constructor(private readonly state: NotesState) {}

  static of(state: NotesState): Notes {
    return new Notes(ownedFields(state, Notes.KEYS));
  }

  private get data(): readonly WorldNote[] {
    return this.state.worldNotes;
  }

  private with(worldNotes: readonly WorldNote[]): Notes {
    return new Notes({ worldNotes });
  }

  /** Записи в порядке появления. Свежее сверху — дело того, кто показывает. */
  get all(): readonly WorldNote[] {
    return this.data;
  }

  private located(id: string): WorldNote {
    const found = this.data.find((note) => note.id === id);
    if (found === undefined) {
      throw new DomainError(`Заметки «${id}» нет среди записанных`);
    }
    return found;
  }

  /**
   * Записывает заметку. Тот же текст, записанный дважды, даёт две записи: сказанное дважды за столом
   * и записано дважды, а склеить их значило бы решить за игрока, что он повторился.
   */
  add(note: { id: string; at: string; text: string }): Notes {
    const written = worldNoteOf(note);
    if (this.data.some((existing) => existing.id === written.id)) {
      throw new DomainError(`Заметка «${written.id}» уже записана`);
    }
    return this.with([...this.data, written]);
  }

  /** Переписывает текст. Время прежнее: исправленная опечатка не двигает запись в начало. */
  edit(id: string, text: string): Notes {
    const written = worldNoteOf({ ...this.located(id), text });
    return this.with(this.data.map((note) => (note.id === id ? written : note)));
  }

  /** Убирает запись целиком: записанного по ошибке иначе не вывести. */
  remove(id: string): Notes {
    this.located(id);
    return this.with(this.data.filter((note) => note.id !== id));
  }

  toState(): NotesState {
    return this.state;
  }
}
