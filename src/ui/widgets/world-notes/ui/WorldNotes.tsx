"use client";

import { useState } from "react";

import type { Snapshot } from "@/contract/snapshot";
import { matchesQuery } from "@/ui/shared/lib/searchable";
import { timeRu } from "@/ui/shared/lib/timeRu";
import { GrowingField } from "@/ui/shared/ui/GrowingField";
import { editName } from "@/ui/shared/ui/buttonLabels";
import { Magnifier } from "@/ui/shared/ui/Magnifier";
import { SURFACE_CHOSEN, SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";

type WorldNote = Snapshot["notes"][number];

const SEARCH_LABEL = "Поиск по слову";
const NOTE_LABEL = "Заметка";
const REMOVE_LABEL = "Убрать";

const MUTED = "text-ink-quiet";

const SELECTED = SURFACE_CHOSEN;

function Time({ at }: { at: string }) {
  return <span className={`shrink-0 text-xs tabular-nums ${MUTED}`}>{timeRu(at)}</span>;
}

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
  const named = editName(note.text);

  if (draft === null) {
    return (
      <li className={`flex items-start justify-between gap-2 p-2 ${SURFACE_GROUP}`}>
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
    <li className={`flex flex-col gap-1 p-2 ${SURFACE_GROUP}`}>
      <GrowingField
        value={draft}
        labelRu={named}
        autoFocus
        onChange={setDraft}
        onSubmit={(text) => {
          if (text !== note.text) onEdit(text);
          setDraft(null);
        }}
        onCancel={() => setDraft(null)}
      />

      <div className="flex items-center justify-between gap-2">
        <Time at={note.at} />
        <button
          type="button"
          aria-label={`${REMOVE_LABEL}: ${note.text}`}
          onClick={onRemove}
          className={`min-h-11 px-3 text-sm ${SURFACE_CONTROL}`}
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
  notes: Snapshot["notes"];
  onAdd: (text: string) => void;
  onEdit: (noteId: string, text: string) => void;
  onRemove: (noteId: string) => void;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const found = [...notes].reverse().filter((note) => matchesQuery(note.text, query ?? ""));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {query === null ? (
            <GrowingField
              value={draft}
              labelRu={NOTE_LABEL}
              onChange={setDraft}
              onSubmit={(text) => {
                onAdd(text);
                setDraft("");
              }}
            />
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
              className={`min-h-11 w-full px-3 text-sm outline-none ${SURFACE_CONTROL}`}
            />
          )}
        </div>

        <button
          type="button"
          aria-pressed={query !== null}
          aria-label={SEARCH_LABEL}
          onClick={() => setQuery(query === null ? "" : null)}
          className={`flex size-11 shrink-0 items-center justify-center ${
            query === null ? SURFACE_CONTROL : SELECTED
          }`}
        >
          <Magnifier />
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
