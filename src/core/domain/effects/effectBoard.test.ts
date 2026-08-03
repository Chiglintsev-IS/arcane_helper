import { describe, expect, it } from "vitest";

import { EffectBoard } from "@/core/domain/effects/effectBoard";
import { DomainError } from "@/core/domain/shared/errors";
import type { ActiveEffect } from "@/core/domain/effects/schema";

function emptyBoard(): EffectBoard {
  return EffectBoard.of({ activeEffects: [], concentration: undefined });
}

/** Эффект без заклинания: то, что заводит игрок вручную. */
function manualEffect(overrides: Partial<ActiveEffect> = {}): ActiveEffect {
  return {
    id: "manual-1",
    nameRu: "Опутанный",
    type: "control",
    startedAt: "2026-08-02T00:00:00.000Z",
    duration: { type: "special" },
    isConcentration: false,
    slotLevelUsed: 0,
    endConditionRu: "Снимается вручную.",
    ...overrides,
  };
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
