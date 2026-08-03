import { describe, expect, it } from "vitest";

import {
  activeEffectSchema,
  characterStateSchema,
  EXPORT_SCHEMA_VERSION,
  exportFileSchema,
  roleplayProfileSchema,
  spellSlotsSchema,
} from "@/core/domain/character/state";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { Equipment } from "@/core/domain/equipment/equipment";

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
    abilities: {
      strength: 8,
      dexterity: 14,
      constitution: 16,
      intelligence: 18,
      wisdom: 12,
      charisma: 8,
    },
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
    arcaneRecovery: { maximum: 4, remaining: 4 },
    hitPoints: { current: 51, maximumBase: 60, bloodReduction: 9, masterReduction: 0 },
    armorClass: { base: 10 },
    runes: { maximum: 3, remaining: 2 },
    spellPoints: { remaining: 3 },
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

  it("время создания очков заклинаний из старого сохранения читается и отбрасывается", () => {
    const legacy = mutate((draft) => {
      draft.spellPoints = { remaining: 3, createdAt: "2026-07-31T18:00:00.000Z" };
    });
    const result = characterStateSchema.safeParse(legacy);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.spellPoints).toEqual({ remaining: 3 });
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

  it("активный эффект без заклинания (ручной) принимается", () => {
    const { spellId: _omitted, ...manual } = WEB_EFFECT;
    expect(
      activeEffectSchema.safeParse({ ...manual, isConcentration: false }).success,
    ).toBe(true);
  });

  it("признак ручного эффекта — закрытый словарь: поправка к КД принимается, чужое слово нет", () => {
    const { spellId: _omitted, ...manual } = WEB_EFFECT;
    const withKind = (manualKind: string) => ({ ...manual, isConcentration: false, manualKind });
    expect(activeEffectSchema.safeParse(withKind("armorAdjustment")).success).toBe(true);
    expect(activeEffectSchema.safeParse(withKind("blessing")).success).toBe(false);
  });

  it("профиль отыгрыша без тона отклоняется", () => {
    const profile = structuredClone(thorne()) as { roleplayProfile: Record<string, unknown> };
    profile.roleplayProfile.tone = [];
    expect(roleplayProfileSchema.safeParse(profile.roleplayProfile).success).toBe(false);
  });
});

describe("exportFileSchema", () => {
  const file = () => ({
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: "2026-07-31T18:30:00.000Z",
    character: thorne(),
    spells: [],
  });

  it("принимает файл текущей версии", () => {
    expect(exportFileSchema.safeParse(file()).success).toBe(true);
  });

  it("отклоняет файл неизвестной версии", () => {
    expect(
      exportFileSchema.safeParse({ ...file(), schemaVersion: EXPORT_SCHEMA_VERSION + 1 }).success,
    ).toBe(false);
  });

  it("отклоняет файл с испорченным состоянием персонажа", () => {
    expect(
      exportFileSchema.safeParse({ ...file(), character: { id: "thorne" } }).success,
    ).toBe(false);
  });
});

describe("лист персонажа", () => {
  it("Торн заполнен целиком", () => {
    const thorneState = createThorne();
    expect(thorneState.species).toBe("Лунный тролль");
    expect(thorneState.subclass).toBe("Создатель рун");
    expect(thorneState.size).toBe("large");
    expect(thorneState.speed).toBe(30);
    expect(thorneState.abilities).toEqual({
      strength: 8,
      dexterity: 14,
      constitution: 16,
      intelligence: 18,
      wisdom: 12,
      charisma: 8,
    });
    expect(thorneState.saveProficiencies).toEqual(["intelligence", "wisdom"]);
    expect(thorneState.skills).toEqual({
      arcana: "proficient",
      investigation: "proficient",
      nature: "proficient",
      perception: "proficient",
    });
    expect(thorneState.miscBonuses).toEqual({
      spellcasting: 0,
      armorClass: 0,
      savingThrows: 0,
    });
    expect(Equipment.of(thorneState).armorClassBase).toBe(10);
    expect(thorneState.equipment.items.map((item) => item.nameRu)).toEqual([
      "Магическая фокусировка +1",
      "Мантия +1",
      "Плащ защиты",
      "Комплект болотной маскировки",
    ]);

    const kit = thorneState.equipment.items.at(-1);
    expect(kit?.note).toBe("1d4 к Скрытности в болотах");
    expect(kit?.bonuses).toBeUndefined();
    expect(kit?.worn).toBe(false);
    // Сохранение Торна не называло количества ни у одной вещи — старая запись читается как одна штука.
    expect(kit?.count).toBe(1);
    expect(kit?.kind).toBe("other");
    expect(thorneState.exhaustion).toBe(0);
    expect(thorneState.inspiration).toBe(false);
    expect(thorneState.overrides).toEqual({ saves: {}, skills: {} });
  });

  it("отсутствующие поля получают значение по умолчанию: обновление не теряет данных", () => {
    const { species: _s, skills: _k, exhaustion: _e, ...withoutNew } = createThorne();
    const parsed = characterStateSchema.parse({
      ...withoutNew,
      abilities: createThorne().abilities,
    });
    expect(parsed.species).toBe("");
    expect(parsed.skills).toEqual({});
    expect(parsed.exhaustion).toBe(0);
  });

  it("характеристика вне диапазона 1–30 отвергается", () => {
    const broken = { ...createThorne(), abilities: { ...createThorne().abilities, strength: 0 } };
    const result = characterStateSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("вещь без количества считается одной штукой: старое сохранение не лжёт о запасах", () => {
    const legacy = {
      ...createThorne(),
      equipment: {
        ...createThorne().equipment,
        items: [{ id: "rope", nameRu: "Верёвка" }],
      },
    };
    const parsed = characterStateSchema.parse(legacy);
    expect(parsed.equipment.items[0]?.count).toBe(1);
  });

  it("счёт вещи — от нуля до предела: ноль хранится, отрицательное и перебор отвергаются", () => {
    const withCount = (count: number) => ({
      ...createThorne(),
      equipment: {
        ...createThorne().equipment,
        items: [{ id: "healing-potion", nameRu: "Зелье лечения", count }],
      },
    });
    expect(characterStateSchema.safeParse(withCount(0)).success).toBe(true);
    expect(characterStateSchema.safeParse(withCount(-1)).success).toBe(false);
    expect(characterStateSchema.safeParse(withCount(9999)).success).toBe(true);
    expect(characterStateSchema.safeParse(withCount(10000)).success).toBe(false);
  });

  it("категория вещи ограничена четырьмя: экипировка, расходник, ингредиент, другое", () => {
    const withKind = (kind: string) => ({
      ...createThorne(),
      equipment: {
        ...createThorne().equipment,
        items: [{ id: "thing", nameRu: "Штука", kind }],
      },
    });
    expect(characterStateSchema.safeParse(withKind("gear")).success).toBe(true);
    expect(characterStateSchema.safeParse(withKind("consumable")).success).toBe(true);
    expect(characterStateSchema.safeParse(withKind("ingredient")).success).toBe(true);
    expect(characterStateSchema.safeParse(withKind("other")).success).toBe(true);
    // Прежние рода в живом состоянии не хранятся: их переводит приведение, а не схема.
    expect(characterStateSchema.safeParse(withKind("potion")).success).toBe(false);
  });

  it("кошелёк по умолчанию пуст, отрицательная монета отвергается", () => {
    const { money: _gone, ...equipment } = createThorne().equipment;
    const parsed = characterStateSchema.parse({ ...createThorne(), equipment });
    expect(parsed.equipment.money).toEqual({ gold: 0, silver: 0, copper: 0 });

    const negative = {
      ...createThorne(),
      equipment: { ...createThorne().equipment, money: { ...parsed.equipment.money, gold: -1 } },
    };
    expect(characterStateSchema.safeParse(negative).success).toBe(false);
  });

  it("цена вещи необязательна, а заданная проверяется монетой и целым числом", () => {
    const withPrice = (price: unknown) => ({
      ...createThorne(),
      equipment: {
        ...createThorne().equipment,
        items: [{ id: "thing", nameRu: "Штука", price }],
      },
    });
    expect(characterStateSchema.safeParse(withPrice({ amount: 50, currency: "gold" })).success).toBe(true);
    expect(characterStateSchema.safeParse(withPrice({ amount: -1, currency: "gold" })).success).toBe(false);
    expect(characterStateSchema.safeParse(withPrice({ amount: 50, currency: "рубль" })).success).toBe(false);
  });
});
