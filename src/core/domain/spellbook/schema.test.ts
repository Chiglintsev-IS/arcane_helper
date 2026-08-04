import { describe, expect, it } from "vitest";

import { z } from "zod";

import {
  SPELLBOOK_FIELDS,
  refineSpellbook,
  type SpellbookState,
} from "@/core/domain/spellbook/schema";

/** Книга целиком: те же поля и тот же доводчик, что собирает в полную схему сборка состояния. */
const book = z.object(SPELLBOOK_FIELDS).superRefine(refineSpellbook);

/**
 * Инварианты книги проверяются на состоянии самой книги: собирать ради них целого персонажа значило
 * бы проверять заодно и его правила. Что сборка вызывает доводчик — отдельный прогон полной схемы.
 */
const BOOK: SpellbookState = {
  cantripIds: ["ray-of-frost"],
  spellbookSpellIds: ["web", "magic-missile"],
  preparedSpellIds: ["web"],
  spellNotes: {},
  roleplayPreferences: {},
};

function firstError(state: SpellbookState): string {
  const outcome = book.safeParse(state);
  if (outcome.success) throw new Error("состояние принято, а ожидался отказ");
  return outcome.error.issues[0]?.message ?? "";
}

describe("инварианты книги заклинаний", () => {
  it("принимает целую книгу", () => {
    expect(book.safeParse(BOOK).success).toBe(true);
  });

  it("отклоняет повторы среди заговоров", () => {
    expect(firstError({ ...BOOK, cantripIds: ["ray-of-frost", "ray-of-frost"] })).toContain(
      "повторяющиеся идентификаторы",
    );
  });

  it("отклоняет повторы в книге", () => {
    expect(firstError({ ...BOOK, spellbookSpellIds: ["web", "web"] })).toContain(
      "повторяющиеся идентификаторы",
    );
  });

  it("отклоняет повторы среди подготовленных", () => {
    expect(firstError({ ...BOOK, preparedSpellIds: ["web", "web"] })).toContain(
      "повторяющиеся идентификаторы",
    );
  });

  it("отклоняет заговор, попавший в книгу", () => {
    expect(firstError({ ...BOOK, spellbookSpellIds: ["web", "ray-of-frost"] })).toContain(
      "одновременно заговор и запись в книге",
    );
  });

  it("отклоняет подготовленное, которого нет в книге", () => {
    expect(firstError({ ...BOOK, preparedSpellIds: ["fireball"] })).toContain(
      "которого нет в книге",
    );
  });
});
