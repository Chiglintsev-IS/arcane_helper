import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  characterStateSchema,
  exportFileSchema,
  EXPORT_SCHEMA_VERSION,
} from "@/core/domain/assembly/state";
import { ARCANA_FIELDS } from "@/core/domain/arcana/schema";
import { CHARACTER_FIELDS } from "@/core/domain/character/schema";
import { EFFECTS_FIELDS } from "@/core/domain/effects/schema";
import { EQUIPMENT_FIELDS } from "@/core/domain/equipment/schema";
import { ITEMS_FIELDS } from "@/core/domain/items/schema";
import { SPELLBOOK_FIELDS } from "@/core/domain/spellbook/schema";
import { VITALITY_FIELDS } from "@/core/domain/vitality/schema";
import { fieldsOf } from "@/core/domain/shared/fields";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

/**
 * Полная схема состояния: что она собирает и что отвергает целиком.
 *
 * Инварианты контекстов проверяются у владельцев — здесь проверяется, что сборка их зовёт: доводчик,
 * которого перестали вызывать, иначе умер бы молча.
 */
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
  contributions: [],
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
    arcaneRecovery: { maximum: 4, remaining: 4 },
    hitPoints: { current: 51, maximumBase: 60, bloodReduction: 9, masterReduction: 0 },
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
  const draft = fieldsOf(structuredClone(thorne()));
  change(draft);
  return draft;
}

function firstError(input: unknown): string {
  const result = characterStateSchema.safeParse(input);
  expect(result.success, "ожидалась ошибка валидации").toBe(false);
  return result.success ? "" : result.error.issues.map((issue) => issue.message).join(" | ");
}

/**
 * Та же сборка, но без снисхождения к лишнему ключу.
 *
 * Обычная схема лишнее срезает молча, и мёртвое поле в фикстуре жило годами: тест «состояние
 * принято» проходил, а поля в состоянии не было. Строгая копия отвечает на другой вопрос — не «можно
 * ли это прочитать», а «то ли это самое состояние».
 */
const strictStateSchema = z.strictObject({
  ...CHARACTER_FIELDS,
  ...ARCANA_FIELDS,
  ...EFFECTS_FIELDS,
  ...EQUIPMENT_FIELDS,
  ...ITEMS_FIELDS,
  ...SPELLBOOK_FIELDS,
  ...VITALITY_FIELDS,
});

describe("форма состояния", () => {
  it("ключи верхнего уровня — те, что названы владельцами", () => {
    // Правишь список — реши, меняется ли форма выгрузки и нужен ли новый EXPORT_SCHEMA_VERSION.
    // Перенос поля между владельцами формы не меняет: ключ остаётся тем же, меняется только то, чья
    // подсхема его объявляет.
    expect(Object.keys(characterStateSchema.shape).sort()).toEqual([
      "abilities",
      "activeEffects",
      "age",
      "arcaneRecovery",
      "cantripIds",
      "className",
      "concentration",
      "equipment",
      "exhaustion",
      "hitDice",
      "hitPoints",
      "id",
      "inspiration",
      "itemDefinitions",
      "level",
      "name",
      "permanentContributions",
      "preparedSpellIds",
      "proficiencies",
      "roleplayPreferences",
      "roleplayProfile",
      "runes",
      "saveProficiencies",
      "shortRestSinceLongRest",
      "size",
      "skills",
      "species",
      "speed",
      "spellNotes",
      "spellPoints",
      "spellSlots",
      "spellbookSpellIds",
      "subclass",
      "suppression",
      "temporaryHitPoints",
    ]);
  });

  it("фикстура состоит только из живых полей: лишний ключ — падение, а не молчание", () => {
    expect(strictStateSchema.safeParse(thorne()).success).toBe(true);
    expect(strictStateSchema.safeParse(createThorne()).success).toBe(true);
  });

  it("строгая копия ловит поле, которого у состояния нет", () => {
    const outdated = mutate((draft) => {
      draft.screenMode = "play";
    });
    expect(strictStateSchema.safeParse(outdated).success).toBe(false);
  });
});

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


describe("состояние целиком", () => {
  it("Торн собирается схемой и не теряет полей со значением по умолчанию", () => {
    const thorneState = createThorne();
    expect(thorneState.species).toBe("Лунный тролль");
    expect(thorneState.subclass).toBe("Создатель рун");
    expect(thorneState.size).toBe("large");
    expect(thorneState.speed).toBe(30);
    expect(thorneState.exhaustion).toBe(0);
    expect(thorneState.inspiration).toBe(false);
    expect(thorneState.permanentContributions).toEqual([]);
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
});
