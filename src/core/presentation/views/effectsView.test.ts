/**
 * Проекция действующего.
 *
 * Проверяется то, что строка списка обязана сказать сама: чем эффект держится и двигает ли он
 * защиту. Числа величин здесь не пересказываются — их складывает лист.
 */

import { describe, expect, it } from "vitest";

import type { CharacterState } from "@/core/domain/assembly/state";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

import { toEffectViews } from "./effectsView";

/** Действующий без заклинания: форма следа, оставленного не карточкой. */
function holding(effect: Partial<CharacterState["activeEffects"][number]>): CharacterState {
  return {
    ...createThorne(),
    activeEffects: [
      {
        id: "effect-1",
        nameRu: "Руна ветра",
        startedAt: "2026-07-31T18:00:00.000Z",
        duration: { type: "rounds", value: 1 },
        isConcentration: false,
        slotLevelUsed: 2,
        contributions: [],
        endConditionRu: "Держится до начала вашего следующего хода.",
        ...effect,
      },
    ],
  };
}

describe("проекция действующего (FR-334)", () => {
  it("вклад в скорость поправкой к защите не считается", () => {
    const [view] = toEffectViews(
      holding({ contributions: [{ stat: "speed", kind: "bonus", value: 10 }] }),
    );

    expect(view?.changesArmorClass).toBe(false);
  });

  it("вклад в защиту признаком назван: иначе поднявшаяся КД остаётся без объяснения", () => {
    const [view] = toEffectViews(
      holding({ contributions: [{ stat: "armorClass", kind: "bonus", value: 5 }] }),
    );

    expect(view?.changesArmorClass).toBe(true);
  });

  it("число эффекта уходит строкой, а без него строки нет вовсе", () => {
    const [noted] = toEffectViews(holding({ note: "+10 футов скорости себе" }));
    const [bare] = toEffectViews(holding({}));

    expect(noted?.noteRu).toBe("+10 футов скорости себе");
    expect(bare?.noteRu).toBeUndefined();
  });
});
