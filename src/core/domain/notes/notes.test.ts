import { describe, expect, it } from "vitest";

import { Notes } from "./notes";

const EMPTY = { worldNotes: [] };

/** Время приходит от часов ядра: агрегат его не выдумывает и не двигает. */
const AT = "2026-08-16T19:30:00.000Z";

const BARON = "Барон обещал мост";

function withBaron(): Notes {
  return Notes.of(EMPTY).add({ id: "note-1", at: AT, text: ` ${BARON} ` });
}

describe("заметки про мир", () => {
  it("заметка заводится текстом, а время ставит приложение (FR-320)", () => {
    expect(withBaron().all).toEqual([{ id: "note-1", at: AT, text: BARON }]);
  });

  it("два одинаковых текста остаются двумя записями, а один идентификатор — одной (FR-320)", () => {
    const twice = withBaron().add({ id: "note-2", at: AT, text: BARON });

    expect(twice.all).toHaveLength(2);
    expect(() => twice.add({ id: "note-1", at: AT, text: "Мельник видел волка" })).toThrow(
      /note-1/,
    );
  });

  it("правка текста времени не двигает (FR-320)", () => {
    const both = withBaron().add({ id: "note-2", at: AT, text: "Мельник видел волка" });
    const edited = both.edit("note-1", "Барон обещал мост к весне");

    // Правится одна запись и на своём месте: соседняя не двигается и не переписывается.
    expect(edited.all).toEqual([
      { id: "note-1", at: AT, text: "Барон обещал мост к весне" },
      { id: "note-2", at: AT, text: "Мельник видел волка" },
    ]);
  });

  it("пустая заметка не заводится и не переписывается (FR-320)", () => {
    expect(() => Notes.of(EMPTY).add({ id: "note-1", at: AT, text: "   " })).toThrow(
      /заметка про мир/,
    );
    expect(() => withBaron().edit("note-1", "")).toThrow(/заметка про мир/);
  });

  it("правка и удаление спрашивают существующую запись (FR-320)", () => {
    expect(() => Notes.of(EMPTY).edit("note-1", BARON)).toThrow(/note-1/);
    expect(() => Notes.of(EMPTY).remove("note-1")).toThrow(/note-1/);
    expect(withBaron().remove("note-1").all).toEqual([]);
  });
});
