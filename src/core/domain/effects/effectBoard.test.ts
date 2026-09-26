import { describe, expect, it } from "vitest";

import { EffectBoard, renamable } from "@/core/domain/effects/effectBoard";
import { DomainError } from "@/core/domain/shared/errors";
import type { Spell } from "@/core/domain/catalog/spell";
import type { ActiveEffect } from "@/core/domain/effects/schema";
import type { StatContribution } from "@/core/domain/shared/stats";

function emptyBoard(): EffectBoard {
  return EffectBoard.of({ activeEffects: [], concentration: undefined });
}

function manualEffect(overrides: Partial<ActiveEffect> = {}): ActiveEffect {
  return {
    id: "manual-1",
    nameRu: "Опутанный",
    startedAt: "2026-08-02T00:00:00.000Z",
    duration: { type: "until_removed" },
    isConcentration: false,
    slotLevelUsed: 0,
    contributions: [],
    endConditionRu: "Снимается вручную.",
    ...overrides,
  };
}

const shieldBonus: StatContribution = { stat: "armorClass", kind: "bonus", value: 5 };

function spellLike(
  id: string,
  nameRu: string,
  contributions: StatContribution[],
): Pick<Spell, "id" | "nameRu" | "contributions"> {
  return { id, nameRu, contributions };
}

describe("EffectBoard.start", () => {
  it("отклоняет концентрационный эффект без заклинания", () => {
    const effect = manualEffect({ isConcentration: true });
    expect(() => emptyBoard().start(effect, effect.startedAt)).toThrow(DomainError);
  });

  it("принимает ручной неконцентрационный эффект на доску", () => {
    const effect = manualEffect();
    const { activeEffects, concentration } = emptyBoard().start(effect, effect.startedAt).toState();
    expect(activeEffects).toEqual([effect]);
    expect(concentration).toBeUndefined();
  });
});

describe("вклады действующего", () => {
  it("действующее приносит свои вклады с именем того, кто их держит", () => {
    const shield = manualEffect({ id: "e-1", nameRu: "Щит", contributions: [shieldBonus] });

    expect(emptyBoard().start(shield, shield.startedAt).contributions()).toEqual([
      { source: { origin: "effect", nameRu: "Щит" }, contribution: shieldBonus },
    ]);
  });

  it("эффект без вкладов на числа не влияет вовсе", () => {
    const status = manualEffect();
    expect(emptyBoard().start(status, status.startedAt).contributions()).toEqual([]);
  });

  it("предпросмотр добавляет вклады заклинания, не трогая состояния", () => {
    const board = emptyBoard();
    const shield = spellLike("shield", "Щит", [shieldBonus]);

    expect(board.contributionsWith(shield)).toEqual([
      { source: { origin: "effect", nameRu: "Щит" }, contribution: shieldBonus },
    ]);
    expect(board.toState().activeEffects).toEqual([]);
  });

  it("повторное применение того же заклинания вклада не удваивает", () => {
    const shield = spellLike("shield", "Щит", [shieldBonus]);
    const active = manualEffect({
      id: "e-1",
      spellId: "shield",
      nameRu: "Щит",
      contributions: [shieldBonus],
    });
    const board = emptyBoard().start(active, active.startedAt);

    expect(board.contributionsWith(shield)).toEqual(board.contributions());
  });

  it("другое заклинание с тем же числом вклад приносит: узнают заклинание, а не совпадение", () => {
    const active = manualEffect({
      id: "e-1",
      spellId: "shield",
      nameRu: "Щит",
      contributions: [shieldBonus],
    });
    const board = emptyBoard().start(active, active.startedAt);
    const other = spellLike("shield-of-faith", "Щит веры", [shieldBonus]);

    expect(board.contributionsWith(other)).toHaveLength(2);
  });

  it("поправка, заведённая шапкой ресурсов, опознаётся родом и читается числом", () => {
    const adjustment = manualEffect({
      id: "e-1",
      nameRu: "Поправка к КД",
      manualKind: "armorAdjustment",
      contributions: [{ stat: "armorClass", kind: "bonus", value: -2 }],
    });
    const board = emptyBoard().start(adjustment, adjustment.startedAt);

    expect(board.manualEffect("armorAdjustment")?.id).toBe("e-1");
    expect(board.manualAdjustment("armorAdjustment")).toBe(-2);
    expect(emptyBoard().manualAdjustment("armorAdjustment")).toBe(0);
  });
});

describe("EffectBoard.afterLongRest", () => {
  it("долгий отдых уносит концентрацию вместе с её эффектом", () => {
    const held = manualEffect({
      id: "e-1",
      spellId: "web",
      nameRu: "Паутина",
      duration: { type: "until_spell_ends" },
      isConcentration: true,
    });
    const { board, expired } = emptyBoard().start(held, held.startedAt).afterLongRest();

    expect(board.toState()).toEqual({ activeEffects: [] });
    expect(expired).toEqual([held]);
  });
});

describe("переименование статуса", () => {
  const status = manualEffect({ id: "status-1", nameRu: "Отравлн", manualKind: "status" });
  const web = manualEffect({
    id: "web-1",
    spellId: "web",
    nameRu: "Паутина",
    duration: { type: "until_spell_ends" },
    isConcentration: true,
    slotLevelUsed: 2,
  });
  const windRune = manualEffect({
    id: "rune-1",
    nameRu: "Руна ветра",
    duration: { type: "rounds", value: 1 },
    slotLevelUsed: 2,
    endConditionRu: "Держится до начала вашего следующего хода.",
  });
  const adjustment = manualEffect({
    id: "adjustment-1",
    nameRu: "Поправка к КД",
    manualKind: "armorAdjustment",
    contributions: [{ stat: "armorClass", kind: "bonus", value: 2 }],
  });
  const board = [status, web, windRune, adjustment].reduce(
    (carried, effect) => carried.start(effect, effect.startedAt),
    emptyBoard(),
  );

  it("набранный статус получает новое название, всё остальное на доске остаётся", () => {
    const { board: renamed, before, after } = board.rename("status-1", "Отравлен");

    expect(before).toEqual(status);
    expect(after).toEqual({ ...status, nameRu: "Отравлен" });
    expect(renamed.toState()).toEqual({
      activeEffects: [after, web, windRune, adjustment],
      concentration: board.toState().concentration,
    });
  });

  it("пробелы по краям названия не записываются", () => {
    expect(board.rename("status-1", "  Отравлен  ").after.nameRu).toBe("Отравлен");
  });

  it("пустое название отвергается той же причиной, что и при заведении статуса", () => {
    expect(() => board.rename("status-1", "   ")).toThrow(
      new DomainError("Название эффекта не может быть пустым"),
    );
  });

  it("название, которое дали заклинание, руна или поправка к КД, не переписывается", () => {
    for (const named of [web, windRune, adjustment]) {
      expect(() => board.rename(named.id, "Иное")).toThrow(
        new DomainError(
          `«${named.nameRu}» не статус: переименовать можно только статус, набранный вручную`,
        ),
      );
    }
  });

  it("эффекта, которого нет на доске, переименовать нельзя", () => {
    expect(() => board.rename("нет-такого", "Отравлен")).toThrow(
      new DomainError("Активного эффекта «нет-такого» нет"),
    );
  });

  it("переименовать можно только статус: признак читается у эффекта", () => {
    expect([status, web, windRune, adjustment].map(renamable)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });
});
