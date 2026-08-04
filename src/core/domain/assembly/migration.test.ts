import { describe, expect, it } from "vitest";

import { Sheet } from "@/core/domain/sheet/sheet";
import { arcaneRecoveryBudget } from "@/core/domain/arcana/slots";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { migrateCharacterState, migrateUndoPatch } from "./migration";
import { characterStateSchema } from "./state";

/** Лист Торна в том виде, в каком его писала версия 1. */
const VERSION_ONE = {
  id: "thorne",
  name: "Торн",
  className: "Волшебник",
  level: 7,
  intelligence: 18,
  spellSaveDc: 16,
  spellAttackModifier: 8,
  constitutionSaveModifier: 4,
  cantripIds: [],
  spellbookSpellIds: [],
  preparedSpellIds: [],
  spellSlots: { 1: { maximum: 4, remaining: 4 } },
  reactionAvailable: true,
  activeEffects: [],
  roleplayProfile: {
    tone: ["sarcastic"],
    magicThemes: [],
    speechStyle: "…",
    gestureStyle: "…",
    preferredElements: [],
    prohibitedThemes: [],
    maximumPhraseLength: 15,
  },
  turnTracking: { actionAvailable: true, bonusActionAvailable: true },
  arcaneRecoveryAvailable: true,
  hitPoints: { current: 51, maximum: 51, maximumReduction: 9 },
  armorClass: { base: 10, dexterityModifier: 2, itemBonus: 2 },
  runes: { maximum: 3, remaining: 3 },
  spellPoints: { remaining: 0, createdAt: null },
  suppression: { firedUpon: false, underDirectSunlight: false },
  spellNotes: {},
  roleplayPreferences: {},
};

describe("приведение состояния версии 1", () => {
  it("ни одно число не едет: прежние производные становятся перебивками", () => {
    const state = characterStateSchema.parse(migrateCharacterState(VERSION_ONE));
    const sheet = Sheet.of(state);
    expect(sheet.spellSaveDc).toBe(16);
    expect(sheet.spellAttackModifier).toBe(8);
    expect(sheet.savingThrow("constitution")).toBe(4);
    // Прибавка версии 1 не называла вещи — она переезжает в прочие прибавки персонажа.
    expect(sheet.armorClassParts).toEqual({
      base: 10,
      baseOverridden: false,
      baseFormula: 10,
      dexterityModifier: 2,
      itemBonus: 0,
      miscBonus: 2,
    });
  });

  it("Интеллект переносится, Ловкость выводится из модификатора, остальные неизвестны", () => {
    const state = characterStateSchema.parse(migrateCharacterState(VERSION_ONE));
    expect(state.abilities.intelligence).toBe(18);
    expect(state.abilities.dexterity).toBe(14);
    expect(state.abilities.strength).toBe(10);
  });

  it("состояние версии 2 проходит насквозь", () => {
    const already = {
      ...VERSION_ONE,
      abilities: {
        strength: 8,
        dexterity: 14,
        constitution: 16,
        intelligence: 18,
        wisdom: 12,
        charisma: 8,
      },
    };
    expect((migrateCharacterState(already) as { abilities: unknown }).abilities).toEqual(
      already.abilities,
    );
  });

  it("максимум разбирается на базу и снижение кровью", () => {
    const state = characterStateSchema.parse(migrateCharacterState(VERSION_ONE));
    expect(state.hitPoints).toEqual({
      current: 51,
      maximumBase: 60,
      bloodReduction: 9,
      masterReduction: 0,
    });
  });

  it("состояние нынешней формы проходит насквозь: снаряжение знает про инвентарь", () => {
    const already = {
      ...VERSION_ONE,
      abilities: createThorne().abilities,
      equipment: createThorne().equipment,
      arcaneRecovery: createThorne().arcaneRecovery,
    };
    expect(migrateCharacterState(already)).toBe(already);
  });

  it("версия 2 переносит базу защиты перебивкой, а прибавки — персонажу, компоненты не теряя", () => {
    const versionTwo = {
      ...VERSION_ONE,
      abilities: createThorne().abilities,
      itemBonuses: { spellcasting: 1, armorClass: 2, savingThrows: 1 },
      armorClass: { base: 13 },
      equipment: { spellcastingFocus: true, componentPouch: false, materialsForSpellIds: ["identify"] },
      hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
    };
    const state = characterStateSchema.parse(migrateCharacterState(versionTwo));

    // Имя доспеха приведение не выдумывает: отличная от 10 база становится перебивкой листа.
    expect(state.overrides.armorClassBase).toBe(13);
    expect(Sheet.of(state).armorClassParts.base).toBe(13);
    expect(state.miscBonuses).toEqual({ spellcasting: 1, armorClass: 2, savingThrows: 1 });
    expect(state.equipment.components?.materialsForSpellIds).toEqual(["identify"]);
    expect(state.equipment.items).toEqual([]);
  });

  it("версия 2 без снаряжения и без прибавок получает умолчания и остаётся без компонентов", () => {
    const bare = {
      ...VERSION_ONE,
      abilities: createThorne().abilities,
      armorClass: undefined,
      equipment: undefined,
      hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
    };
    const state = characterStateSchema.parse(migrateCharacterState(bare));

    // База 10 — умолчание, а не выбор игрока: перебивка из неё не делается.
    expect(state.overrides.armorClassBase).toBeUndefined();
    expect(Sheet.of(state).armorClassParts.base).toBe(10);
    expect(state.miscBonuses).toEqual({ spellcasting: 0, armorClass: 0, savingThrows: 0 });
    expect(state.equipment.components).toBeUndefined();
  });

  it("версия 1 со снаряжением переносит компоненты вместе с прибавками", () => {
    const withComponents = {
      ...VERSION_ONE,
      equipment: { spellcastingFocus: true, componentPouch: false, materialsForSpellIds: [] },
    };
    const state = characterStateSchema.parse(migrateCharacterState(withComponents));
    expect(state.equipment.components?.spellcastingFocus).toBe(true);
    expect(state.miscBonuses.armorClass).toBe(2);
  });

  it("не объект остаётся собой: испорченные данные отвергнет схема, а не приведение", () => {
    expect(migrateCharacterState(null)).toBeNull();
    expect(migrateCharacterState("сломано")).toBe("сломано");
  });

  it("сохранение без слагаемых защиты и без производных получает нули", () => {
    const bare = {
      ...VERSION_ONE,
      intelligence: undefined,
      spellSaveDc: undefined,
      spellAttackModifier: undefined,
      constitutionSaveModifier: undefined,
      armorClass: undefined,
      hitPoints: undefined,
    };
    const migrated = migrateCharacterState(bare) as {
      abilities: { intelligence: number; dexterity: number };
      miscBonuses: { armorClass: number };
      overrides: { spellSaveDc?: number; armorClassBase?: number; saves: Record<string, number> };
    };
    expect(migrated.abilities.intelligence).toBe(10);
    expect(migrated.abilities.dexterity).toBe(10);
    expect(migrated.overrides.armorClassBase).toBeUndefined();
    expect(migrated.miscBonuses.armorClass).toBe(0);
    expect(migrated.overrides.spellSaveDc).toBeUndefined();
    expect(migrated.overrides.saves).toEqual({});
  });

  describe("признак магического восстановления становится дневным бюджетом", () => {
    const budget = arcaneRecoveryBudget(VERSION_ONE.level);

    it("доступный флаг переносится как полный бюджет", () => {
      const migrated = migrateCharacterState({
        ...VERSION_ONE,
        arcaneRecoveryAvailable: true,
      }) as { arcaneRecovery: { maximum: number; remaining: number } };
      expect(migrated.arcaneRecovery).toEqual({ maximum: budget, remaining: budget });
    });

    it("потраченный флаг переносится как нулевой остаток — тот же бюджет, но исчерпанный", () => {
      const migrated = migrateCharacterState({
        ...VERSION_ONE,
        arcaneRecoveryAvailable: false,
      }) as { arcaneRecovery: { maximum: number; remaining: number } };
      expect(migrated.arcaneRecovery).toEqual({ maximum: budget, remaining: 0 });
    });

    it("уже приведённое состояние не трогается", () => {
      const already = { ...VERSION_ONE, arcaneRecovery: { maximum: 4, remaining: 2 } };
      const migrated = migrateCharacterState(already) as { arcaneRecovery: unknown };
      expect(migrated.arcaneRecovery).toEqual({ maximum: 4, remaining: 2 });
    });

    it("испорченный уровень получает нулевой бюджет вместо падения", () => {
      const corrupted = { ...VERSION_ONE, level: "семь" };
      const migrated = migrateCharacterState(corrupted) as { arcaneRecovery: unknown };
      expect(migrated.arcaneRecovery).toEqual({ maximum: 0, remaining: 0 });
    });

    it("сохранение вовсе без признака приведению не подлежит", () => {
      const { arcaneRecoveryAvailable: _omitted, ...withoutFlag } = VERSION_ONE;
      const migrated = migrateCharacterState(withoutFlag) as { arcaneRecovery?: unknown };
      expect(migrated.arcaneRecovery).toBeUndefined();
    });

    it("не объекту приведение не нужно", () => {
      expect(migrateCharacterState(null)).toBeNull();
      expect(migrateCharacterState("не состояние")).toBe("не состояние");
    });
  });

  describe("род вещи становится категорией", () => {
    const withItems = (items: unknown[]) => {
      const state = createThorne();
      return { ...state, equipment: { ...state.equipment, items } };
    };
    const itemsOf = (migrated: unknown) =>
      (migrated as { equipment: { items: Record<string, unknown>[] } }).equipment.items;

    it("зелье — расходник, хлам — «другое», ингредиент остаётся собой", () => {
      const migrated = migrateCharacterState(
        withItems([
          { id: "potion", nameRu: "Зелье", kind: "potion" },
          { id: "junk", nameRu: "Черепок", kind: "junk" },
          { id: "dust", nameRu: "Пыль", kind: "ingredient" },
        ]),
      );
      expect(itemsOf(migrated).map((item) => item.kind)).toEqual([
        "consumable",
        "other",
        "ingredient",
      ]);
    });

    it("вещь без рода опознаётся по свойствам экипировки, и база доспеха среди них", () => {
      const migrated = migrateCharacterState(
        withItems([
          { id: "robe", nameRu: "Мантия", worn: true },
          { id: "ring", nameRu: "Кольцо", worn: false, bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 } },
          { id: "breastplate", nameRu: "Кираса", worn: false, armorBase: 14 },
          { id: "rope", nameRu: "Верёвка", worn: false },
        ]),
      );
      expect(itemsOf(migrated).map((item) => item.kind)).toEqual(["gear", "gear", "gear", "other"]);
      // База доспеха у экипировки остаётся: снимать её значило бы терять доспех игрока.
      expect(itemsOf(migrated)[2]?.armorBase).toBe(14);
    });

    it("надетость вне экипировки снимается: надетое зелье не двигает числа", () => {
      const migrated = migrateCharacterState(
        withItems([{ id: "potion", nameRu: "Зелье", kind: "potion", worn: true }]),
      );
      expect(itemsOf(migrated)[0]).toMatchObject({ kind: "consumable", worn: false });
    });

    it("прибавка и база доспеха вне экипировки снимаются, а сохранение читается (FR-238)", () => {
      const migrated = migrateCharacterState(
        withItems([
          {
            id: "potion",
            nameRu: "Зелье",
            kind: "potion",
            bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 },
            armorBase: 16,
          },
        ]),
      );
      expect(itemsOf(migrated)[0]).toEqual({
        id: "potion",
        nameRu: "Зелье",
        kind: "consumable",
        worn: false,
      });
      // Приведённое проходит объявление целиком: снимается ровно то, чего объявление не примет.
      expect(characterStateSchema.safeParse(migrated).success).toBe(true);
    });

    it("надетый ингредиент прежней сборки снимается и с уже верной категорией", () => {
      const migrated = migrateCharacterState(
        withItems([{ id: "dust", nameRu: "Пыль", kind: "ingredient", worn: true }]),
      );
      expect(itemsOf(migrated)[0]).toMatchObject({ kind: "ingredient", worn: false });
    });

    it("счёт выше предела обрезается пределом: старое сохранение обязано читаться", () => {
      const migrated = migrateCharacterState(
        withItems([{ id: "arrows", nameRu: "Стрелы", kind: "other", count: 15000 }]),
      );
      expect(itemsOf(migrated)[0]?.count).toBe(9999);
    });

    it("снимок отмены приводится так же, как состояние", () => {
      const patch = {
        equipment: {
          armorClassBase: 10,
          otherBonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
          items: [{ id: "potion", nameRu: "Зелье", kind: "potion", worn: true }],
        },
      };
      const migrated = migrateUndoPatch(patch) as typeof patch;
      expect(migrated.equipment.items[0]).toMatchObject({ kind: "consumable", worn: false });
      // Снимок без снаряжения проходит насквозь: приводить в нём нечего.
      const bare = { hitPoints: { current: 1 } };
      expect(migrateUndoPatch(bare)).toBe(bare);
    });

    it("состояние с новыми категориями проходит насквозь той же ссылкой", () => {
      const fresh = createThorne();
      expect(migrateCharacterState(fresh)).toBe(fresh);
    });

    it("порченые записи проходят как есть: их отвергнет схема, а не приведение", () => {
      const state = withItems(["не вещь", null]);
      expect(itemsOf(migrateCharacterState(state))).toEqual(["не вещь", null]);
    });

    it("состояние без списка вещей приведению не подлежит", () => {
      const state = createThorne();
      const broken = { ...state, equipment: { ...state.equipment, items: "не список" } };
      expect(migrateCharacterState(broken)).toBe(broken);
    });
  });

  describe("«прибавки без вещи» становятся прочими прибавками персонажа", () => {
    const bonuses = { spellcasting: 1, armorClass: 2, savingThrows: 0 };
    /** Сохранение версии 3: прибавки лежат в снаряжении, а поля прочих прибавок ещё нет. */
    const legacyState = () => {
      const { miscBonuses: _absent, ...state } = createThorne() as Record<string, unknown> & {
        miscBonuses: unknown;
      };
      return {
        ...state,
        equipment: { ...(state.equipment as object), otherBonuses: bonuses },
      };
    };

    it("прибавки переезжают из снаряжения к персонажу", () => {
      const migrated = migrateCharacterState(legacyState()) as {
        miscBonuses: unknown;
        equipment: Record<string, unknown>;
      };
      expect(migrated.miscBonuses).toEqual(bonuses);
      expect("otherBonuses" in migrated.equipment).toBe(false);
    });

    it("уже заведённые прочие прибавки не затираются прежним полем", () => {
      const both = { ...legacyState(), miscBonuses: { spellcasting: 9, armorClass: 0, savingThrows: 0 } };
      const migrated = migrateCharacterState(both) as { miscBonuses: { spellcasting: number } };
      expect(migrated.miscBonuses.spellcasting).toBe(9);
    });

    it("состояние без прежнего поля проходит насквозь той же ссылкой", () => {
      const fresh = createThorne();
      expect(migrateCharacterState(fresh)).toBe(fresh);
    });

    it("снимок отмены приводится так же, как состояние", () => {
      const patch = { equipment: { items: [], otherBonuses: bonuses } };
      const migrated = migrateUndoPatch(patch) as {
        miscBonuses: unknown;
        equipment: Record<string, unknown>;
      };
      expect(migrated.miscBonuses).toEqual(bonuses);
      expect("otherBonuses" in migrated.equipment).toBe(false);
    });
  });

  describe("поправка к КД получает типизированный признак", () => {
    const legacyAdjustment = {
      id: "adjustment",
      nameRu: "Поправка к КД",
      startedAt: "2026-07-31T12:00:00.000Z",
      duration: { type: "special" },
      isConcentration: false,
      slotLevelUsed: 0,
      armorClass: { kind: "bonus", value: 2 },
      endConditionRu: "Снимается вручную.",
    };
    const withEffects = (activeEffects: unknown[]) => ({ ...createThorne(), activeEffects });
    const effectsOf = (migrated: unknown) =>
      (migrated as { activeEffects: Record<string, unknown>[] }).activeEffects;

    it("эффект прежней формы с именем и вкладом получает признак", () => {
      const migrated = migrateCharacterState(withEffects([legacyAdjustment]));
      expect(effectsOf(migrated)[0]?.manualKind).toBe("armorAdjustment");
    });

    it("статус того же имени без вклада в КД признака не получает", () => {
      const { armorClass: _none, ...namesake } = legacyAdjustment;
      const migrated = migrateCharacterState(withEffects([namesake]));
      expect(effectsOf(migrated)[0]?.manualKind).toBeUndefined();
    });

    it("чужой эффект не трогается, эффект с признаком проходит насквозь той же ссылкой", () => {
      const marked = withEffects([{ ...legacyAdjustment, manualKind: "armorAdjustment" }]);
      expect(migrateCharacterState(marked)).toBe(marked);

      const foreign = withEffects([{ ...legacyAdjustment, nameRu: "Прикрытие союзника" }]);
      expect(effectsOf(migrateCharacterState(foreign))[0]?.manualKind).toBeUndefined();
    });

    it("порченая запись эффекта проходит как есть: её отвергнет схема, а не приведение", () => {
      const migrated = migrateCharacterState(withEffects(["не эффект", null]));
      expect(effectsOf(migrated)).toEqual(["не эффект", null]);
    });

    it("состояние без списка эффектов приведению не подлежит", () => {
      const broken = { ...createThorne(), activeEffects: "не список" };
      expect(migrateCharacterState(broken)).toBe(broken);
    });

    it("снимок отмены приводится так же, как состояние", () => {
      const patch = { activeEffects: [legacyAdjustment] };
      const migrated = migrateUndoPatch(patch) as { activeEffects: { manualKind?: string }[] };
      expect(migrated.activeEffects[0]?.manualKind).toBe("armorAdjustment");
    });
  });

  it("не объекту приведение не нужно", () => {
      expect(migrateCharacterState(null)).toBeNull();
      expect(migrateCharacterState("не состояние")).toBe("не состояние");
    });

  describe("поля, которые перестали принадлежать персонажу, читаются и отбрасываются", () => {
    const legacy = VERSION_FIVE;

    it("сохранение прежней версии открывается", () => {
      expect(characterStateSchema.safeParse(migrateCharacterState(legacy)).success).toBe(true);
    });

    it("прочитанное состояние их не несёт: экономию хода считает журнал, режим держит оболочка", () => {
      const state = characterStateSchema.parse(migrateCharacterState(legacy)) as Record<
        string,
        unknown
      >;
      expect(state).not.toHaveProperty("reactionAvailable");
      expect(state).not.toHaveProperty("turnTracking");
      expect(state).not.toHaveProperty("screenMode");
    });
  });
});

/** Части сохранения, не менявшиеся от версии к версии: кто он, книга, ячейки, руны, отыгрыш. */
const {
  intelligence: _derivedIntelligence,
  spellSaveDc: _derivedSaveDc,
  spellAttackModifier: _derivedAttack,
  constitutionSaveModifier: _derivedSave,
  armorClass: _derivedArmorClass,
  arcaneRecoveryAvailable: _recoveryFlag,
  hitPoints: _oneMaximum,
  ...UNCHANGED
} = VERSION_ONE;

/** Хиты в форме, появившейся вместе с характеристиками: база и снижение кровью раздельно. */
const SPLIT_HIT_POINTS = { current: 51, maximumBase: 60, bloodReduction: 9, masterReduction: 0 };

/** Компоненты: единственное, что знало плоское снаряжение версии 2. */
const COMPONENTS = { spellcastingFocus: true, componentPouch: false, materialsForSpellIds: ["identify"] };

/** Версия 2: характеристики появились, снаряжение ещё плоское, прибавки лежат у персонажа. */
const VERSION_TWO = {
  ...UNCHANGED,
  abilities: createThorne().abilities,
  itemBonuses: { spellcasting: 0, armorClass: 2, savingThrows: 0 },
  armorClass: { base: 10 },
  equipment: COMPONENTS,
  arcaneRecoveryAvailable: true,
  hitPoints: SPLIT_HIT_POINTS,
};

/** Версия 3: у снаряжения появился инвентарь, и вещи носили прежние рода. */
const VERSION_THREE = {
  ...UNCHANGED,
  abilities: createThorne().abilities,
  arcaneRecovery: { maximum: 4, remaining: 4 },
  hitPoints: SPLIT_HIT_POINTS,
  equipment: {
    otherBonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
    items: [
      { id: "healing-potion", nameRu: "Зелье лечения", kind: "potion", count: 2 },
      { id: "rope", nameRu: "Верёвка", kind: "junk", worn: true, count: 1 },
    ],
    components: COMPONENTS,
  },
};

/** Версия 4: снаряжение хранило базу Класса Доспеха числом, без имени доспеха. */
const VERSION_FOUR = {
  ...UNCHANGED,
  abilities: createThorne().abilities,
  arcaneRecovery: { maximum: 4, remaining: 4 },
  hitPoints: SPLIT_HIT_POINTS,
  equipment: {
    armorClassBase: 16,
    otherBonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
    items: [{ id: "chain-mail", nameRu: "Кольчуга", kind: "gear", worn: true, count: 1 }],
    components: COMPONENTS,
  },
};

/** Версия 5: форма нынешняя, но экономию хода и режим экрана состояние ещё держало само. */
const VERSION_FIVE = {
  ...createThorne(),
  reactionAvailable: false,
  turnTracking: { enabled: true, actionAvailable: false, bonusActionAvailable: false },
  screenMode: "book",
};

/** Версия 6: то, что пишет приложение сегодня. */
const VERSION_SIX = createThorne();

describe("сохранение каждой версии открывается целиком, и числа за столом не едут", () => {
  it.each([
    ["1", VERSION_ONE, { current: 51, maximumBase: 60, base: 10, overridden: false, saveDc: 16 }],
    // У версий 2–4 перебивки КС нет: число считается от характеристик, и прибавки предмета к магии
    // в этих сохранениях не было — 8 + 3 + 4.
    ["2", VERSION_TWO, { current: 51, maximumBase: 60, base: 10, overridden: false, saveDc: 15 }],
    ["3", VERSION_THREE, { current: 51, maximumBase: 60, base: 10, overridden: false, saveDc: 15 }],
    ["4", VERSION_FOUR, { current: 51, maximumBase: 60, base: 16, overridden: true, saveDc: 15 }],
    ["5", VERSION_FIVE, { current: 60, maximumBase: 60, base: 10, overridden: false, saveDc: 16 }],
    ["6", VERSION_SIX, { current: 60, maximumBase: 60, base: 10, overridden: false, saveDc: 16 }],
  ])("версия %s", (_version, save, expected) => {
    const state = characterStateSchema.parse(migrateCharacterState(save));
    const sheet = Sheet.of(state);

    expect(state.hitPoints.current).toBe(expected.current);
    expect(state.hitPoints.maximumBase).toBe(expected.maximumBase);
    expect(state.spellSlots[1]?.remaining).toBe(4);
    expect(sheet.spellSaveDc).toBe(expected.saveDc);
    expect(sheet.armorClassParts.base).toBe(expected.base);
    expect(sheet.armorClassParts.baseOverridden).toBe(expected.overridden);
  });

  it("рода вещей версии 3 становятся категориями, надетость вне экипировки снимается", () => {
    const state = characterStateSchema.parse(migrateCharacterState(VERSION_THREE));
    expect(state.equipment.items.map((item) => [item.kind, item.worn])).toEqual([
      ["consumable", false],
      ["other", false],
    ]);
  });
});
