import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { Sheet } from "./sheet";
import type { CharacterState } from "@/core/domain/assembly/state";

const sheetOf = (state: CharacterState = createThorne()) => Sheet.of(state);

describe("производные числа листа", () => {
  it("числа Торна сходятся с листом персонажа без единой перебивки", () => {
    const sheet = sheetOf();
    expect(sheet.proficiencyBonus).toBe(3);
    expect(sheet.spellSaveDc).toBe(16);
    expect(sheet.spellAttackModifier).toBe(8);
    expect(sheet.preparationLimit).toBe(11);
    expect(sheet.initiative).toBe(1);
    expect(sheet.savingThrow("constitution")).toBe(4);
    expect(sheet.savingThrow("intelligence")).toBe(8);
    expect(sheet.savingThrow("wisdom")).toBe(5);
    expect(sheet.savingThrow("strength")).toBe(0);
    expect(sheet.armorClassParts).toEqual({
      base: 10,
      baseOverridden: false,
      baseFormula: 10,
      dexterityModifier: 2,
      itemBonus: 2,
      miscBonus: 0,
    });
    expect(sheet.skill("arcana")).toBe(7);
    expect(sheet.skill("investigation")).toBe(7);
    expect(sheet.skill("nature")).toBe(7);
    expect(sheet.skill("perception")).toBe(4);
    expect(sheet.passivePerception).toBe(14);
  });

  it("прочие прибавки персонажа складываются с надетым", () => {
    const state = createThorne();
    const blessed = sheetOf({
      ...state,
      miscBonuses: { spellcasting: 2, armorClass: 1, savingThrows: 1 },
    });
    // КС 16 = 8 + 3 + 4 + 1 (фокусировка); благословение +2 поверх.
    expect(blessed.spellSaveDc).toBe(18);
    // Спасбросок Телосложения 4 = 3 + 1 (плащ); дар +1 поверх.
    expect(blessed.savingThrow("constitution")).toBe(5);
    expect(blessed.armorClassParts.miscBonus).toBe(1);
  });

  it("перебивка базы КД отмечается признаком в слагаемых", () => {
    const state = createThorne();
    const overridden = sheetOf({
      ...state,
      overrides: { ...state.overrides, armorClassBase: 14 },
    });
    expect(overridden.armorClassParts.baseOverridden).toBe(true);
    expect(overridden.armorClassParts.base).toBe(14);
    // База по надетому идёт рядом с перебитой: отступают от неё, к ней и возвращаются.
    expect(overridden.armorClassParts.baseFormula).toBe(10);
  });

  it("инициатива двигается за Мудростью, а не только за Ловкостью", () => {
    const state = createThorne();
    // Ловкость 14 (+2), Мудрость 16 (+3): (2 + 3) ÷ 2 вниз.
    expect(sheetOf({ ...state, abilities: { ...state.abilities, wisdom: 16 } }).initiative).toBe(2);
  });

  it("навык без владения — только модификатор характеристики", () => {
    expect(sheetOf().skill("history")).toBe(4);
  });

  it("владение навыком прибавляет бонус мастерства, компетентность — дважды", () => {
    const state = createThorne();
    expect(sheetOf({ ...state, skills: { arcana: "proficient" } }).skill("arcana")).toBe(7);
    expect(sheetOf({ ...state, skills: { arcana: "expert" } }).skill("arcana")).toBe(10);
  });

  it("пассивное восприятие считается от навыка Восприятия", () => {
    expect(sheetOf().passivePerception).toBe(14);
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
    expect(overridden.skill("arcana")).toBe(9);
    // КС и атака заклинаний тоже читают перебитый бонус, а не пересчитывают его из уровня.
    expect(overridden.spellSaveDc).toBe(18);
    expect(overridden.spellAttackModifier).toBe(10);
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

  it("перечень производных называет перебитые и несёт формулу рядом с перебитым", () => {
    const state = createThorne();
    const list = sheetOf({ ...state, overrides: { ...state.overrides, initiative: 5 } }).derived();
    expect(list).toContainEqual({ id: "initiative", value: 5, overridden: true, formula: 1 });
    expect(list).toContainEqual({ id: "spellSaveDc", value: 16, overridden: false, formula: 16 });
  });

  it("значение по формуле считается по действующим основаниям, а не мимо перебивок", () => {
    const state = createThorne();
    const list = sheetOf({
      ...state,
      overrides: { ...state.overrides, proficiencyBonus: 5, spellSaveDc: 20 },
    }).derived();
    // Бонус мастерства перебит, и формула КС читает его: 8 + 5 + 4 + 1. Иначе шторка называла бы
    // число, которого на листе нет ни у одного соседа.
    expect(list).toContainEqual({ id: "spellSaveDc", value: 20, overridden: true, formula: 18 });
  });
});
