"use client";

import { useState } from "react";

import { BUTTON_LABELS, editName } from "@/ui/shared/ui/buttonLabels";
import { GrowingField } from "@/ui/shared/ui/GrowingField";
import { QuickAddField } from "@/ui/shared/ui/QuickAddField";
import { RULE_BETWEEN } from "@/ui/shared/ui/rule";
import { SURFACE_CONTROL } from "@/ui/shared/ui/surface";

export const NOTES_TITLE = "Заметки";

const NOTE_FIELD = "Заметка";

const NOTES_EMPTY = "Ничего не записано словами";

type Note = { readonly id: string; readonly textRu: string };

/**
 * Слова о вещи: короткими записями, каждая правится и убирается отдельно. Одним сплошным текстом их
 * не держат — за столом они приходят по одной и живут поодиночке.
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
  const [opened, setOpened] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const open = (id: string, textRu: string): void => {
    setOpened(id);
    setDraft(textRu);
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-ink-quiet">{NOTES_TITLE}</span>

      <QuickAddField labelRu={NOTE_FIELD} onAdd={onAdd} />

      {notes.length === 0 ? (
        <p className="text-xs text-ink-quiet">{NOTES_EMPTY}</p>
      ) : (
        <ul aria-label={NOTES_TITLE} className={`flex flex-col ${RULE_BETWEEN}`}>
          {notes.map((note) =>
            note.id === opened ? (
              <li key={note.id} className="flex flex-col gap-1 py-1.5">
                <GrowingField
                  labelRu={NOTE_FIELD}
                  value={draft}
                  autoFocus
                  onChange={setDraft}
                  onSubmit={(text) => {
                    setOpened(null);
                    onRewrite(note.id, text);
                  }}
                  onCancel={() => setOpened(null)}
                />
                <button
                  type="button"
                  onClick={() => {
                    setOpened(null);
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
                  onClick={() => open(note.id, note.textRu)}
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
