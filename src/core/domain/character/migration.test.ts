import { describe, expect, it } from "vitest";

import { Sheet } from "@/core/domain/sheet/sheet";
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
});
