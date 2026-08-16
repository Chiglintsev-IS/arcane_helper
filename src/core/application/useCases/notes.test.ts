import { describe, expect, it } from "vitest";

import { Notes } from "@/core/domain/notes/notes";
import { undoLast, type Occasion, type Session } from "@/core/application/session";
import { spendSpellSlot } from "@/core/application/useCases/resources";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { addWorldNote, editWorldNote, removeWorldNote } from "./notes";

const AT = "2026-08-16T19:30:00.000Z";

const BARON = "Барон обещал мост";

function occasionOf(commandId: string): Occasion {
  let issued = 0;
  return { now: () => AT, nextId: () => `${commandId}-${++issued}`, commandId };
}

function session(): Session {
  return { character: createThorne(), journal: [] };
}

function written(): Session {
  return addWorldNote(session(), BARON, occasionOf("command-1"));
}

function only(state: Session["character"]) {
  return Notes.of(state).all[0];
}

describe("заметки про мир", () => {
  it("заметка про мир журнала не занимает и переживает отмену (FR-320)", () => {
    const start = written();

    expect(start.journal).toEqual([]);
    expect(only(start.character)).toEqual({ id: "command-1-1", at: AT, text: BARON });

    // Отмена возвращает потраченное, а записанное словами не трогает: его в снимке отмены нет.
    const spent = spendSpellSlot(start, 1, occasionOf("command-2"));
    const returned = undoLast(spent);

    expect(returned.journal).toEqual([]);
    expect(only(returned.character)).toEqual({ id: "command-1-1", at: AT, text: BARON });
  });

  it("правка и удаление записи журнала не заводят (FR-320)", () => {
    const start = written();
    const noteId = only(start.character)?.id ?? "";

    const edited = editWorldNote(start, noteId, "Барон обещал мост к весне");

    expect(edited.journal).toEqual([]);
    expect(only(edited.character)).toEqual({
      id: noteId,
      at: AT,
      text: "Барон обещал мост к весне",
    });

    const removed = removeWorldNote(edited, noteId);

    expect(removed.journal).toEqual([]);
    expect(Notes.of(removed.character).all).toEqual([]);
  });
});
