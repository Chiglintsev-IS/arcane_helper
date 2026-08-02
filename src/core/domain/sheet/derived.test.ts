import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { Sheet } from "./sheet";
import { abilityModifiers } from "./derived";
import { Equipment } from "@/core/domain/equipment/equipment";
import type { CharacterState } from "@/core/domain/character/state";

const sheetOf = (state: CharacterState = createThorne()) => Sheet.of(state);

describe("производные числа листа", () => {
  it("числа Торна сходятся с листом персонажа без единой перебивки", () => {
    const sheet = sheetOf();
    expect(sheet.proficiencyBonus).toBe(3);
    expect(sheet.spellSaveDc).toBe(16);
    expect(sheet.spellAttackModifier).toBe(8);
    expect(sheet.preparationLimit).toBe(11);
    expect(sheet.initiative).toBe(2);
    expect(sheet.savingThrow("constitution")).toBe(4);
    expect(sheet.savingThrow("intelligence")).toBe(8);
    expect(sheet.savingThrow("wisdom")).toBe(5);
    expect(sheet.savingThrow("strength")).toBe(0);
    expect(sheet.armorClassParts).toEqual({ base: 10, dexterityModifier: 2, itemBonus: 2 });
  });

  it("навык без владения — только модификатор характеристики", () => {
    expect(sheetOf().skill("arcana")).toBe(4);
  });

  it("владение навыком прибавляет бонус мастерства, компетентность — дважды", () => {
    const state = createThorne();
    expect(sheetOf({ ...state, skills: { arcana: "proficient" } }).skill("arcana")).toBe(7);
    expect(sheetOf({ ...state, skills: { arcana: "expert" } }).skill("arcana")).toBe(10);
  });

  it("пассивное восприятие считается от Мудрости", () => {
    expect(sheetOf().passivePerception).toBe(11);
  });

  it("перебивка перекрывает формулу", () => {
    const state = createThorne();
    const overridden = sheetOf({
      ...state,
      overrides: { ...state.overrides, spellSaveDc: 18, saves: { constitution: 9 } },
    });
    expect(overridden.spellSaveDc).toBe(18);
    expect(overridden.savingThrow("constitution")).toBe(9);
    // Соседнее число перебивкой не задето.
    expect(overridden.spellAttackModifier).toBe(8);
  });

  it("перебивки бонуса мастерства, лимита подготовки и пассивного восприятия действуют", () => {
    const state = createThorne();
    const overridden = sheetOf({
      ...state,
      overrides: {
        ...state.overrides,
        proficiencyBonus: 5,
        preparedLimit: 20,
        passivePerception: 30,
      },
    });
    expect(overridden.proficiencyBonus).toBe(5);
    expect(overridden.preparationLimit).toBe(20);
    expect(overridden.passivePerception).toBe(30);
    // Бонус мастерства перебит — спасбросок с владением считается по новому бонусу.
    expect(overridden.savingThrow("intelligence")).toBe(10);
    expect(overridden.skill("arcana")).toBe(4);
  });

  it("перебивка навыка перекрывает счёт по владению", () => {
    const state = createThorne();
    const overridden = sheetOf({
      ...state,
      skills: { arcana: "proficient" },
      overrides: { ...state.overrides, skills: { arcana: 12 } },
    });
    expect(overridden.skill("arcana")).toBe(12);
  });

  it("правка Интеллекта двигает КС, атаку и лимит подготовки", () => {
    const state = createThorne();
    const smarter = sheetOf({ ...state, abilities: { ...state.abilities, intelligence: 20 } });
    expect(smarter.spellSaveDc).toBe(17);
    expect(smarter.spellAttackModifier).toBe(9);
    expect(smarter.preparationLimit).toBe(12);
  });

  it("модификаторы всех шести характеристик считаются разом", () => {
    const state = createThorne();
    expect(
      abilityModifiers({
        ...state,
        bonuses: Equipment.of(state).bonuses,
        armorClassBase: state.equipment.armorClassBase,
      }),
    ).toEqual({
      strength: -1,
      dexterity: 2,
      constitution: 3,
      intelligence: 4,
      wisdom: 1,
      charisma: -1,
    });
  });

  it("перечень производных называет, какие из них перебиты", () => {
    const state = createThorne();
    const list = sheetOf({ ...state, overrides: { ...state.overrides, initiative: 5 } }).derived();
    expect(list).toContainEqual({ id: "initiative", value: 5, overridden: true });
    expect(list).toContainEqual({ id: "spellSaveDc", value: 16, overridden: false });
  });
});
