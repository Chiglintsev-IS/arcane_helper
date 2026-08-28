import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  characterStateSchema,
  exportFileSchema,
  EXPORT_SCHEMA_VERSION,
  isStateField,
} from "@/core/domain/assembly/state";
import { ARCANA_FIELDS } from "@/core/domain/arcana/schema";
import { CHARACTER_FIELDS } from "@/core/domain/character/schema";
import { CRAFTING_FIELDS } from "@/core/domain/crafting/schema";
import { EFFECTS_FIELDS } from "@/core/domain/effects/schema";
import { EQUIPMENT_FIELDS } from "@/core/domain/equipment/schema";
import { ITEMS_FIELDS } from "@/core/domain/items/schema";
import { NOTES_FIELDS } from "@/core/domain/notes/schema";
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
    arcaneRecovery: { maximum: 4, remaining: 4 },
    hitPoints: { current: 51, maximumBase: 60, bloodReduction: 9, masterReduction: 0 },
    runes: { maximum: 3, remaining: 2 },
    suppression: { firedUponTurnStarts: 0, underDirectSunlight: false },
    spellNotes: { web: "Мастер считает, что паутина не горит." },
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
  ...CRAFTING_FIELDS,
  ...EFFECTS_FIELDS,
  ...EQUIPMENT_FIELDS,
  ...ITEMS_FIELDS,
  ...NOTES_FIELDS,
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
      "alchemyApparatus",
      "arcaneRecovery",
      "cantripIds",
      "className",
      "concentration",
      "equipment",
      "exhaustion",
      "features",
      "hitDice",
      "hitPoints",
      "id",
      "ingredientKnowledge",
      "inspiration",
      "itemDefinitions",
      "knownRecipes",
      "lastHint",
      "level",
      "name",
      "preparedSpellIds",
      "proficiencies",
      "runes",
      "saveProficiencies",
      "shortRestSinceLongRest",
      "size",
      "skills",
      "species",
      "speed",
      "spellNotes",
      "spellSlots",
      "spellbookSpellIds",
      "studiedDirections",
      "subclass",
      "suppression",
      "temporaryHitPoints",
      "worldNotes",
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

  it("поле состояния — своё поле, а не любое доступное объекту имя", () => {
    expect(isStateField("spellSlots")).toBe(true);
    expect(isStateField("turnTracking")).toBe(false);
    // Имена из прототипа доступны каждому объекту: поиском по цепочке они прошли бы за поля.
    expect(isStateField("toString")).toBe(false);
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

  it("сохранение без последней подсказки открывается с целой подсказкой", () => {
    const older = mutate((draft) => {
      delete draft.lastHint;
    });
    const result = characterStateSchema.safeParse(older);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.lastHint).toEqual({ maximum: 1, remaining: 1 });
  });

  it("очки заклинаний из старого сохранения читаются и отбрасываются", () => {
    const legacy = mutate((draft) => {
      draft.spellPoints = { remaining: 3, createdAt: "2026-07-31T18:00:00.000Z" };
    });
    const result = characterStateSchema.safeParse(legacy);
    expect(result.success).toBe(true);
    // Ресурса больше нет, и состояние им не обзаводится: поле снимается чтением.
    if (result.success) expect("spellPoints" in result.data).toBe(false);
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
    expect(thorneState.speed).toBe(30);
    expect(thorneState.exhaustion).toBe(0);
    expect(thorneState.inspiration).toBe(false);
  });

  it("отсутствующие поля получают значение по умолчанию: обновление не теряет данных", () => {
    const { species: _s, skills: _k, exhaustion: _e, features: _f, ...withoutNew } = createThorne();
    const parsed = characterStateSchema.parse({
      ...withoutNew,
      abilities: createThorne().abilities,
    });
    expect(parsed.species).toBe("");
    expect(parsed.skills).toEqual({});
    expect(parsed.exhaustion).toBe(0);
    expect(parsed.features).toEqual([]);
  });
});
