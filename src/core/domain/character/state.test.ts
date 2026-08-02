import { describe, expect, it } from "vitest";

import {
  activeEffectSchema,
  characterStateSchema,
  exportFileSchema,
  roleplayProfileSchema,
  spellSlotsSchema,
} from "@/core/domain/character/state";

const WEB_EFFECT = {
  id: "effect-web",
  spellId: "web",
  nameRu: "Паутина",
  type: "control",
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

/** Торн: подготовлены «Паутина» и «Волшебная стрела», концентрация на «Паутине». */
function thorne(): unknown {
  return {
    id: "thorne",
    name: "Торн",
    className: "Волшебник",
    level: 7,
    intelligence: 18,
    spellSaveDc: 15,
    spellAttackModifier: 7,
    constitutionSaveModifier: 1,
    cantripIds: ["ray-of-frost", "shocking-grasp"],
    spellbookSpellIds: ["web", "magic-missile", "detect-magic"],
    preparedSpellIds: ["web", "magic-missile"],
    spellSlots: {
      1: { maximum: 4, remaining: 4 },
      2: { maximum: 3, remaining: 2 },
      3: { maximum: 3, remaining: 3 },
      4: { maximum: 1, remaining: 1 },
    },
    reactionAvailable: true,
    concentration: { spellId: "web", startedAt: "2026-07-31T18:00:00.000Z" },
    activeEffects: [WEB_EFFECT],
    roleplayProfile: {
      tone: ["sarcastic", "mysterious"],
      magicThemes: ["руны", "молнии", "холод", "алхимические символы"],
      speechStyle: "Короткие формулы и язвительные замечания",
      gestureStyle: "Рисует знаки пальцами, посохом или мелом",
      preferredElements: ["электричество", "холод", "сила"],
      prohibitedThemes: ["огонь"],
      maximumPhraseLength: 15,
    },
    turnTracking: { enabled: true, actionAvailable: false, bonusActionAvailable: true },
    arcaneRecoveryAvailable: true,
    hitPoints: { current: 51, maximum: 51, maximumReduction: 9 },
    armorClass: { base: 10, dexterityModifier: 2, itemBonus: 2 },
    runes: { maximum: 3, remaining: 2 },
    spellPoints: { remaining: 3, createdAt: "2026-07-31T18:00:00.000Z" },
    suppression: { firedUpon: false, underDirectSunlight: false },
    spellNotes: { web: "Мастер считает, что паутина не горит." },
    roleplayPreferences: {
      web: {
        favoriteVariantIds: ["web-short-1"],
        disabledVariantIds: [],
        customVariants: [{ id: "web-custom-1", category: "short", text: "Проход зарос." }],
        usageCount: { "web-short-1": 3 },
      },
    },
  };
}

function mutate(change: (draft: Record<string, unknown>) => void): unknown {
  const draft = structuredClone(thorne()) as Record<string, unknown>;
  change(draft);
  return draft;
}

function firstError(input: unknown): string {
  const result = characterStateSchema.safeParse(input);
  expect(result.success, "ожидалась ошибка валидации").toBe(false);
  return result.success ? "" : result.error.issues.map((issue) => issue.message).join(" | ");
}

describe("characterStateSchema принимает корректное состояние", () => {
  it("состояние Торна", () => {
    const result = characterStateSchema.safeParse(thorne());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.spellSlots[2]).toEqual({ maximum: 3, remaining: 2 });
    }
  });

  it("состояние без концентрации и без эффектов", () => {
    const idle = mutate((draft) => {
      delete draft.concentration;
      draft.activeEffects = [];
    });
    expect(characterStateSchema.safeParse(idle).success).toBe(true);
  });
});

describe("ячейки заклинаний", () => {
  it("отклоняет остаток выше максимума", () => {
    expect(
      spellSlotsSchema.safeParse({ 1: { maximum: 4, remaining: 5 } }).success,
    ).toBe(false);
  });

  it("допускает отрицательный остаток: долг после «Применить всё равно»", () => {
    expect(spellSlotsSchema.safeParse({ 1: { maximum: 4, remaining: -1 } }).success).toBe(true);
  });

  it("отклоняет уровень ячейки вне 1…9", () => {
    expect(spellSlotsSchema.safeParse({ 0: { maximum: 1, remaining: 1 } }).success).toBe(false);
    expect(spellSlotsSchema.safeParse({ 10: { maximum: 1, remaining: 1 } }).success).toBe(false);
  });
});

describe("целостность списков заклинаний", () => {
  it("отклоняет повторы в книге заклинаний", () => {
    expect(firstError(mutate((draft) => { draft.spellbookSpellIds = ["web", "web"]; })))
      .toContain("повторяющиеся идентификаторы");
  });

  it("отклоняет повторы среди заговоров", () => {
    expect(firstError(mutate((draft) => { draft.cantripIds = ["ray-of-frost", "ray-of-frost"]; })))
      .toContain("повторяющиеся идентификаторы");
  });

  it("отклоняет заговор, попавший в книгу заклинаний", () => {
    expect(
      firstError(
        mutate((draft) => {
          draft.spellbookSpellIds = ["web", "magic-missile", "detect-magic", "ray-of-frost"];
        }),
      ),
    ).toContain("одновременно заговор и запись в книге");
  });

  it("отклоняет подготовленное заклинание, которого нет в книге", () => {
    expect(firstError(mutate((draft) => { draft.preparedSpellIds = ["web", "fireball"]; })))
      .toContain("которого нет в книге");
  });
});

describe("инварианты концентрации", () => {
  it("отклоняет концентрацию без соответствующего активного эффекта", () => {
    expect(firstError(mutate((draft) => { draft.activeEffects = []; })))
      .toContain("без соответствующего активного эффекта");
  });

  it("отклоняет два одновременных концентрационных эффекта", () => {
    const twoEffects = mutate((draft) => {
      draft.activeEffects = [
        WEB_EFFECT,
        { ...WEB_EFFECT, id: "effect-blur", spellId: "blur", nameRu: "Размытие" },
      ];
    });
    expect(firstError(twoEffects)).toContain("концентрационных эффекта");
  });

  it("допускает несколько эффектов, если концентрационный только один", () => {
    const mixed = mutate((draft) => {
      draft.activeEffects = [
        WEB_EFFECT,
        {
          ...WEB_EFFECT,
          id: "effect-mage-armor",
          spellId: "mage-armor",
          nameRu: "Доспехи мага",
          isConcentration: false,
          type: "buff",
        },
      ];
    });
    expect(characterStateSchema.safeParse(mixed).success).toBe(true);
  });

  it("отклоняет некорректную дату начала концентрации", () => {
    expect(
      firstError(mutate((draft) => { draft.concentration = { spellId: "web", startedAt: "вчера" }; })),
    ).toContain("ISO 8601");
  });
});

describe("схемы вложенных структур", () => {
  it("активный эффект без условия завершения отклоняется", () => {
    const { endConditionRu: _omitted, ...withoutCondition } = WEB_EFFECT;
    expect(activeEffectSchema.safeParse(withoutCondition).success).toBe(false);
  });

  it("активный эффект без повторяемого действия принимается", () => {
    const { repeatableAction: _omitted, ...withoutAction } = WEB_EFFECT;
    expect(activeEffectSchema.safeParse(withoutAction).success).toBe(true);
  });

  it("профиль отыгрыша без тона отклоняется", () => {
    const profile = structuredClone(thorne()) as { roleplayProfile: Record<string, unknown> };
    profile.roleplayProfile.tone = [];
    expect(roleplayProfileSchema.safeParse(profile.roleplayProfile).success).toBe(false);
  });
});

describe("exportFileSchema", () => {
  const file = () => ({
    schemaVersion: 1,
    exportedAt: "2026-07-31T18:30:00.000Z",
    character: thorne(),
    spells: [],
  });

  it("принимает файл текущей версии", () => {
    expect(exportFileSchema.safeParse(file()).success).toBe(true);
  });

  it("отклоняет файл неизвестной версии", () => {
    expect(exportFileSchema.safeParse({ ...file(), schemaVersion: 2 }).success).toBe(false);
  });

  it("отклоняет файл с испорченным состоянием персонажа", () => {
    expect(
      exportFileSchema.safeParse({ ...file(), character: { id: "thorne" } }).success,
    ).toBe(false);
  });
});
