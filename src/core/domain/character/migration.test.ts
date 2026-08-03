import { describe, expect, it } from "vitest";

import { Sheet } from "@/core/domain/sheet/sheet";
import { arcaneRecoveryBudget } from "@/core/domain/arcana/slots";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { migrateCharacterState } from "./migration";
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
    expect(sheet.armorClassParts).toEqual({ base: 10, dexterityModifier: 2, itemBonus: 2 });
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

  it("состояние версии 3 проходит насквозь: снаряжение уже знает про базу защиты", () => {
    const already = {
      ...VERSION_ONE,
      abilities: createThorne().abilities,
      equipment: createThorne().equipment,
      arcaneRecovery: createThorne().arcaneRecovery,
    };
    expect(migrateCharacterState(already)).toBe(already);
  });

  it("версия 2 переносит прибавки и базу защиты в снаряжение, компоненты не теряя", () => {
    const versionTwo = {
      ...VERSION_ONE,
      abilities: createThorne().abilities,
      itemBonuses: { spellcasting: 1, armorClass: 2, savingThrows: 1 },
      armorClass: { base: 13 },
      equipment: { spellcastingFocus: true, componentPouch: false, materialsForSpellIds: ["identify"] },
      hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
    };
    const state = characterStateSchema.parse(migrateCharacterState(versionTwo));

    expect(state.equipment.armorClassBase).toBe(13);
    expect(state.equipment.otherBonuses).toEqual({ spellcasting: 1, armorClass: 2, savingThrows: 1 });
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

    expect(state.equipment.armorClassBase).toBe(10);
    expect(state.equipment.otherBonuses).toEqual({ spellcasting: 0, armorClass: 0, savingThrows: 0 });
    expect(state.equipment.components).toBeUndefined();
  });

  it("версия 1 со снаряжением переносит компоненты вместе с прибавками", () => {
    const withComponents = {
      ...VERSION_ONE,
      equipment: { spellcastingFocus: true, componentPouch: false, materialsForSpellIds: [] },
    };
    const state = characterStateSchema.parse(migrateCharacterState(withComponents));
    expect(state.equipment.components?.spellcastingFocus).toBe(true);
    expect(state.equipment.otherBonuses.armorClass).toBe(2);
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
      equipment: { armorClassBase: number; otherBonuses: { armorClass: number } };
      overrides: { spellSaveDc?: number; saves: Record<string, number> };
    };
    expect(migrated.abilities.intelligence).toBe(10);
    expect(migrated.abilities.dexterity).toBe(10);
    expect(migrated.equipment.armorClassBase).toBe(10);
    expect(migrated.equipment.otherBonuses.armorClass).toBe(0);
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

    it("вещь без рода опознаётся по поведению: надетая или с прибавкой — экипировка", () => {
      const migrated = migrateCharacterState(
        withItems([
          { id: "robe", nameRu: "Мантия", worn: true },
          { id: "ring", nameRu: "Кольцо", worn: false, bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 } },
          { id: "rope", nameRu: "Верёвка", worn: false },
        ]),
      );
      expect(itemsOf(migrated).map((item) => item.kind)).toEqual(["gear", "gear", "other"]);
    });

    it("надетость вне экипировки снимается: надетое зелье не двигает числа", () => {
      const migrated = migrateCharacterState(
        withItems([{ id: "potion", nameRu: "Зелье", kind: "potion", worn: true }]),
      );
      expect(itemsOf(migrated)[0]).toMatchObject({ kind: "consumable", worn: false });
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

  describe("режимы «Бой» и «Вне боя» слились в «Игру»", () => {
    it("прежний режим читается как «Игра»", () => {
      for (const screenMode of ["combat", "camp"]) {
        const migrated = migrateCharacterState({ ...createThorne(), screenMode }) as {
          screenMode: string;
        };
        expect(migrated.screenMode, screenMode).toBe("play");
      }
    });

    it("уцелевший режим не трогается", () => {
      const migrated = migrateCharacterState({ ...createThorne(), screenMode: "book" }) as {
        screenMode: string;
      };
      expect(migrated.screenMode).toBe("book");
    });

    it("испорченное значение не подменяется молча: его отвергнет схема", () => {
      const migrated = migrateCharacterState({ ...createThorne(), screenMode: 7 }) as {
        screenMode: unknown;
      };
      expect(migrated.screenMode).toBe(7);
    });

    it("не объекту приведение не нужно", () => {
      expect(migrateCharacterState(null)).toBeNull();
      expect(migrateCharacterState("не состояние")).toBe("не состояние");
    });
  });
});
