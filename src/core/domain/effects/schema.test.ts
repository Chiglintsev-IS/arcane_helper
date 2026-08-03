import { describe, expect, it } from "vitest";

import {
  activeEffectSchema,
  effectsStateSchema,
  type ActiveEffect,
  type EffectsState,
} from "@/core/domain/effects/schema";

/**
 * Инварианты доски проверяются на самой доске: собирать ради них целого персонажа значило бы
 * проверять заодно и его правила. Что сборка вызывает доводчик — отдельный прогон полной схемы.
 */
function effect(overrides: Partial<ActiveEffect> = {}): ActiveEffect {
  return {
    id: "effect-1",
    spellId: "detect-magic",
    nameRu: "Обнаружение магии",
    startedAt: "2026-07-31T18:00:00.000Z",
    duration: { type: "minutes", value: 10 },
    isConcentration: true,
    slotLevelUsed: 1,
    endConditionRu: "До конца концентрации.",
    ...overrides,
  };
}

const HOLDING: EffectsState = {
  activeEffects: [effect()],
  concentration: { spellId: "detect-magic", startedAt: "2026-07-31T18:00:00.000Z" },
};

function firstError(state: EffectsState): string {
  const outcome = effectsStateSchema.safeParse(state);
  if (outcome.success) throw new Error("состояние принято, а ожидался отказ");
  return outcome.error.issues[0]?.message ?? "";
}

describe("инварианты доски эффектов", () => {
  it("принимает концентрацию вместе с её эффектом", () => {
    expect(effectsStateSchema.safeParse(HOLDING).success).toBe(true);
  });

  it("принимает доску без концентрации вовсе", () => {
    expect(
      effectsStateSchema.safeParse({
        activeEffects: [effect({ isConcentration: false })],
      }).success,
    ).toBe(true);
  });

  it("отклоняет концентрацию без своего активного эффекта", () => {
    expect(firstError({ ...HOLDING, activeEffects: [] })).toContain(
      "без соответствующего активного эффекта",
    );
  });

  it("отклоняет концентрацию, чей эффект держит другое заклинание", () => {
    expect(
      firstError({ ...HOLDING, activeEffects: [effect({ spellId: "web" })] }),
    ).toContain("без соответствующего активного эффекта");
  });

  it("отклоняет вторую концентрацию", () => {
    expect(
      firstError({
        ...HOLDING,
        activeEffects: [effect(), effect({ id: "effect-2", spellId: "web", nameRu: "Паутина" })],
      }),
    ).toContain("Одновременно активно 2 концентрационных эффекта");
  });
});

describe("схема активного эффекта", () => {
  const WEB_EFFECT = {
    id: "effect-web",
    spellId: "web",
    nameRu: "Паутина",
    startedAt: "2026-07-31T18:00:00.000Z",
    duration: { type: "hours", value: 1 },
    isConcentration: true,
    slotLevelUsed: 2,
    repeatableAction: {
      label: "Спасбросок Ловкости для входящих в область",
      description: "Существо, входящее в область, совершает спасбросок Ловкости.",
    },
    endConditionRu: "До конца концентрации или 1 час.",
  };

  it("эффект без условия завершения отклоняется", () => {
    const { endConditionRu: _omitted, ...withoutCondition } = WEB_EFFECT;
    expect(activeEffectSchema.safeParse(withoutCondition).success).toBe(false);
  });

  it("эффект без повторяемого действия принимается", () => {
    const { repeatableAction: _omitted, ...withoutAction } = WEB_EFFECT;
    expect(activeEffectSchema.safeParse(withoutAction).success).toBe(true);
  });

  it("эффект без заклинания (ручной) принимается", () => {
    const { spellId: _omitted, ...manual } = WEB_EFFECT;
    expect(activeEffectSchema.safeParse({ ...manual, isConcentration: false }).success).toBe(true);
  });

  it("признак ручного эффекта — закрытый словарь: поправка к КД принимается, чужое слово нет", () => {
    const { spellId: _omitted, ...manual } = WEB_EFFECT;
    const withKind = (manualKind: string) => ({ ...manual, isConcentration: false, manualKind });
    expect(activeEffectSchema.safeParse(withKind("armorAdjustment")).success).toBe(true);
    expect(activeEffectSchema.safeParse(withKind("blessing")).success).toBe(false);
  });
});
