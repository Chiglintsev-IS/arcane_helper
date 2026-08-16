/**
 * Записанное о мире: строка ввода и записи под ней.
 *
 * Свежее сверху и время в той же строке, что и текст: строк на экране столько, сколько записей, и
 * вторая строка у каждой стоила бы половины экрана.
 *
 * Правят и убирают запись из её собственной строки: нажатие на текст открывает такое же поле, каким
 * заводят новую, — и там же встаёт «Убрать». Шторки для этого нет: правят не список, а запись, и
 * открывает её та строка, на которую смотрят.
 *
 * Поиск встаёт на место ввода и возвращает его тем же нажатием: пишущий новую запись и ищущий старую
 * спрашивают разное, а два поля подряд заставляли бы выбирать, в которое из них печатать.
 *
 * Компонент презентационный: записи приходят параметром, а что с ними сделать — обратными вызовами.
 */

"use client";

import { useState, type FormEvent } from "react";

import type { Snapshot } from "@/contract/snapshot";
import { matchesQuery } from "@/ui/shared/lib/searchable";
import { timeRu } from "@/ui/shared/lib/timeRu";
import { QuickAddField } from "@/ui/shared/ui/QuickAddField";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

type WorldNote = Snapshot["notes"][number];

/**
 * Кнопка носит короткое слово, а называется целиком: полное имя растянуло бы строку ввода до
 * ширины, на которой в поле не видно набранного, а слышащий экран обязан получить вопрос целиком.
 */
const SEARCH_LABEL = "Поиск по слову";
const SEARCH_SHORT = "Поиск";
const EDIT_LABEL = "Править";
const REMOVE_LABEL = "Убрать";

const MUTED = "text-slate-600 dark:text-slate-400";

/** Нажатое отмечено подложкой своего значения — тем же способом, что и выбранная ячейка панели. */
const SELECTED = "bg-action/20 text-action-strong dark:text-action-bright";

/** Время строки: приглушённое и моноширинное — его сканируют взглядом, а не читают. */
function Time({ at }: { at: string }) {
  return <span className={`shrink-0 text-xs tabular-nums ${MUTED}`}>{timeRu(at)}</span>;
}

/**
 * Строка записи: сама себе и текст, и его правка.
 *
 * Набранное вступает в силу по «Ввод» — тем же способом, каким заводится новая запись. Пустое поле
 * не уходит владельцу: просить его не о чем.
 *
 * «Убрать» стоит только в раскрытой строке. Возврата у удаления нет, и одиночное касание по
 * закрытой строке его не совершает.
 */
function NoteRow({
  note,
  onEdit,
  onRemove,
}: {
  note: WorldNote;
  onEdit: (text: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const named = `${EDIT_LABEL}: ${note.text}`;

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const text = (draft ?? "").trim();
    if (text === "") return;
    if (text !== note.text) onEdit(text);
    setDraft(null);
  };

  if (draft === null) {
    return (
      <li className={`flex items-start justify-between gap-2 rounded-xl p-2 ${SURFACE_GROUP}`}>
        <button
          type="button"
          aria-label={named}
          onClick={() => setDraft(note.text)}
          className="flex min-h-11 min-w-0 flex-1 items-start text-left text-sm leading-snug"
        >
          {note.text}
        </button>
        <Time at={note.at} />
      </li>
    );
  }

  return (
    <li className={`flex flex-col gap-1 rounded-xl p-2 ${SURFACE_GROUP}`}>
      <form onSubmit={submit}>
        <input
          type="text"
          autoFocus
          value={draft}
          aria-label={named}
          enterKeyHint="done"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setDraft(null);
          }}
          className={`min-h-11 w-full rounded-lg px-2 text-sm outline-none ${SURFACE_CONTROL}`}
        />
      </form>

      <div className="flex items-center justify-between gap-2">
        <Time at={note.at} />
        <button
          type="button"
          aria-label={`${REMOVE_LABEL}: ${note.text}`}
          onClick={onRemove}
          className={`min-h-11 rounded-xl px-3 text-sm ${SURFACE_CONTROL}`}
        >
          {REMOVE_LABEL}
        </button>
      </div>
    </li>
  );
}

export function WorldNotes({
  notes,
  onAdd,
  onEdit,
  onRemove,
}: {
  /** Записи в порядке появления: свежее показывается сверху. */
  notes: Snapshot["notes"];
  onAdd: (text: string) => void;
  onEdit: (noteId: string, text: string) => void;
  onRemove: (noteId: string) => void;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const found = [...notes].reverse().filter((note) => matchesQuery(note.text, query ?? ""));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {query === null ? (
            <QuickAddField labelRu="Заметка" onAdd={onAdd} />
          ) : (
            <input
              type="search"
              autoFocus
              value={query}
              aria-label={SEARCH_LABEL}
              placeholder="Слово"
              enterKeyHint="search"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setQuery(null);
              }}
              className={`min-h-11 w-full rounded-lg px-3 text-sm outline-none ${SURFACE_CONTROL}`}
            />
          )}
        </div>

        <button
          type="button"
          aria-pressed={query !== null}
          aria-label={SEARCH_LABEL}
          onClick={() => setQuery(query === null ? "" : null)}
          className={`min-h-11 shrink-0 rounded-xl px-3 text-sm ${
            query === null ? SURFACE_CONTROL : SELECTED
          }`}
        >
          {SEARCH_SHORT}
        </button>
      </div>

      {found.length === 0 ? (
        <p className={`text-sm ${MUTED}`}>
          {notes.length === 0 ? "Пока ничего не записано." : "Ни одна запись не отвечает набранному."}
        </p>
      ) : (
        <ul aria-label="Записи про мир" className="flex flex-col gap-2">
          {found.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              onEdit={(text) => onEdit(note.id, text)}
              onRemove={() => onRemove(note.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
