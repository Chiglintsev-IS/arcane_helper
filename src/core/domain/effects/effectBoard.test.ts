import { describe, expect, it } from "vitest";

import { EffectBoard } from "@/core/domain/effects/effectBoard";
import { DomainError } from "@/core/domain/shared/errors";
import type { Spell } from "@/core/domain/catalog/spell";
import type { ActiveEffect } from "@/core/domain/effects/schema";
import type { StatContribution } from "@/core/domain/shared/stats";

function emptyBoard(): EffectBoard {
  return EffectBoard.of({ activeEffects: [], concentration: undefined });
}

/** Эффект без заклинания: то, что заводит игрок вручную. */
function manualEffect(overrides: Partial<ActiveEffect> = {}): ActiveEffect {
  return {
    id: "manual-1",
    nameRu: "Опутанный",
    startedAt: "2026-08-02T00:00:00.000Z",
    duration: { type: "special" },
    isConcentration: false,
    slotLevelUsed: 0,
    contributions: [],
    endConditionRu: "Снимается вручную.",
    ...overrides,
  };
}

const shieldBonus: StatContribution = { stat: "armorClass", kind: "bonus", value: 5 };

/** Заклинание в том объёме, в каком его читает доска: опознание, имя и вклады. */
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
