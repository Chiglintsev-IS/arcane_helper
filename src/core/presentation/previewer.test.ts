/**
 * Ответ на вопрос: набранное, посчитанное владельцем правила.
 *
 * Проверяется главное свойство вопроса — он ничего не меняет: предпросмотр невозможной правки
 * приходит ответом, а не отказом, и состояние после вопроса то же, что до него.
 */

import { describe, expect, it } from "vitest";

import { createSession, type LiveSession } from "@/core/application/session";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";

import { answerQuestion } from "./previewer";

function alive(character: CharacterState = createThorne()): LiveSession {
  return {
    session: createSession(character),
    spellCatalog: loadThorneSpells(),
    spellCatalogSource: "built_in",
  };
}

describe("здоровье", () => {
  it("называет действующий максимум по набранному, а не по сохранённому", () => {
    const preview = answerQuestion(alive(), {
      kind: "health_preview",
      maximumBase: 70,
      masterReduction: 10,
    });

    expect(preview).toEqual({ kind: "health_preview", effectiveMaximum: 60 });
  });

  it("невозможному набору отвечает пустотой, а не отказом: игрок ещё печатает", () => {
    const preview = answerQuestion(alive(), {
      kind: "health_preview",
      maximumBase: 0,
      masterReduction: 0,
    });

    expect(preview).toEqual({ kind: "health_preview", effectiveMaximum: null });
  });

  it("вопрос состояния не двигает", () => {
    const live = alive();
    const before = live.session.character;

    answerQuestion(live, { kind: "health_preview", maximumBase: 70, masterReduction: 0 });

    expect(live.session.character).toBe(before);
    expect(live.session.journal).toHaveLength(0);
  });
});

describe("уровень", () => {
  it("сдвиг ячейки едет вместе с её уровнем", () => {
    const preview = answerQuestion(alive(), { kind: "level_preview", level: 8 });

    expect(preview.kind === "level_preview" && preview.changes).toContainEqual({
      of: "slots",
      slotLevel: 4,
      before: 1,
      after: 2,
    });
  });

  it("сдвиг величины без уровня ячейки едет без него", () => {
    const preview = answerQuestion(alive(), { kind: "level_preview", level: 9 });

    expect(preview.kind === "level_preview" && preview.changes).toContainEqual({
      of: "runes",
      before: 3,
      after: 4,
    });
  });

  it("невозможному уровню отвечать нечем: ни сдвигов, ни средней прибавки", () => {
    const preview = answerQuestion(alive(), { kind: "level_preview", level: 21 });

    expect(preview).toEqual({ kind: "level_preview", changes: [], hitPoints: null });
  });

  it("среднее за взятый уровень едет слагаемыми: кость бросает игрок", () => {
    const preview = answerQuestion(alive(), { kind: "level_preview", level: 8 });

    expect(preview.kind === "level_preview" && preview.hitPoints).toMatchObject({ total: 7 });
  });
});
