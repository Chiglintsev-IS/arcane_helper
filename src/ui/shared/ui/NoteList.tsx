"use client";

import { useState } from "react";

import { BUTTON_LABELS, editName } from "@/ui/shared/ui/buttonLabels";
import { FieldForm } from "@/ui/shared/ui/FieldForm";
import { GrowingField } from "@/ui/shared/ui/GrowingField";
import { RULE_BETWEEN, RULE_GROUP } from "@/ui/shared/ui/rule";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";
import { TONE_TEXT } from "@/ui/shared/ui/tone";

export const NOTES_TITLE = "Заметки";

const NOTE_FIELD = "Заметка";

const ADD_NOTE = "Записать заметку";

const NOTES_EMPTY = "Ничего не записано словами";

type Note = { readonly id: string; readonly textRu: string };

/** Что правят: новую заметку или уже записанную. Открытой бывает одна — двух правок разом не ведут. */
type Opened = { readonly kind: "new" } | { readonly kind: "note"; readonly id: string };

/**
 * Слова о вещи: короткими записями, каждая правится и убирается отдельно. Одним сплошным текстом их
 * не держат — за столом они приходят по одной и живут поодиночке. Правка идёт той же формой, что и
 * всюду: набранное вступает в силу ответом, а не уходом из поля.
 */
export function NoteList({
  notes,
  onAdd,
  onRewrite,
  onDrop,
}: {
  notes: readonly Note[];
  onAdd: (textRu: string) => void;
  onRewrite: (noteId: string, textRu: string) => void;
  onDrop: (noteId: string) => void;
}) {
  const [opened, setOpened] = useState<Opened | null>(null);
  const [draft, setDraft] = useState("");

  const open = (next: Opened, textRu: string): void => {
    setOpened(next);
    setDraft(textRu);
  };

  const close = (): void => {
    setOpened(null);
    setDraft("");
  };

  const write = (): void => {
    const textRu = draft.trim();
    if (textRu === "" || opened === null) return close();
    if (opened.kind === "new") onAdd(textRu);
    else onRewrite(opened.id, textRu);
    close();
  };

  const field = (
    <FieldForm titleRu={NOTE_FIELD} onWrite={write} onCancel={close}>
      <GrowingField labelRu={NOTE_FIELD} value={draft} autoFocus onChange={setDraft} onSubmit={write} />
    </FieldForm>
  );

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-quiet">{NOTES_TITLE}</span>

      {opened?.kind === "new" ? (
        field
      ) : (
        <button
          type="button"
          onClick={() => open({ kind: "new" }, "")}
          className={`min-h-11 px-3 text-xs font-medium ${TONE_TEXT.action} ${RULE_GROUP}`}
        >
          {ADD_NOTE}
        </button>
      )}

      {notes.length === 0 ? (
        <p className="text-xs text-ink-quiet">{NOTES_EMPTY}</p>
      ) : (
        <ul aria-label={NOTES_TITLE} className={`flex flex-col ${RULE_BETWEEN}`}>
          {notes.map((note) =>
            opened?.kind === "note" && opened.id === note.id ? (
              <li key={note.id} className="flex flex-col gap-1 py-1.5">
                {field}
                <button
                  type="button"
                  onClick={() => {
                    close();
                    onDrop(note.id);
                  }}
                  className={`min-h-11 px-3 text-xs font-medium text-reaction ${SURFACE_CONTROL}`}
                >
                  {BUTTON_LABELS.remove}
                </button>
              </li>
            ) : (
              <li key={note.id} className="py-1.5">
                <button
                  type="button"
                  aria-label={editName(note.textRu)}
                  onClick={() => open({ kind: "note", id: note.id }, note.textRu)}
                  className="w-full text-left text-sm leading-snug"
                >
                  {note.textRu}
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
