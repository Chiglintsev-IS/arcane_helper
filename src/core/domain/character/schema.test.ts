import { describe, expect, it } from "vitest";

import { z } from "zod";

import { CHARACTER_FIELDS } from "@/core/domain/character/schema";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { Character } from "@/core/domain/assembly/character";
import { DomainError } from "@/core/domain/shared/errors";
import { NO_ITEM_BONUSES, type ItemBonuses } from "@/core/domain/shared/schema";
import { Sheet } from "@/core/domain/sheet/sheet";

/**
 * Поля самого Торна: кто он без вещей, ресурсов и заклинаний. Схема контекста лишнее отбрасывает,
 * поэтому полное состояние ей подходит как есть.
 */
describe("подсхема персонажа", () => {
  it("принимает Торна", () => {
    expect(z.object(CHARACTER_FIELDS).safeParse(createThorne()).success).toBe(true);
  });

  it("характеристика вне диапазона 1–30 отвергается", () => {
    const broken = { ...createThorne(), abilities: { ...createThorne().abilities, strength: 0 } };
    expect(z.object(CHARACTER_FIELDS).safeParse(broken).success).toBe(false);
  });

  it("уровень персонажа вне диапазона 1–20 отвергается", () => {
    expect(z.object(CHARACTER_FIELDS).safeParse({ ...createThorne(), level: 0 }).success).toBe(false);
    expect(z.object(CHARACTER_FIELDS).safeParse({ ...createThorne(), level: 21 }).success).toBe(false);
  });

  it("ступень истощения ограничена шестью", () => {
    expect(z.object(CHARACTER_FIELDS).safeParse({ ...createThorne(), exhaustion: 6 }).success).toBe(true);
    expect(z.object(CHARACTER_FIELDS).safeParse({ ...createThorne(), exhaustion: 7 }).success).toBe(false);
  });

  it("лист Торна заполнен целиком", () => {
    const thorneState = createThorne();
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
  });

  it("профиль отыгрыша без тона отклоняется", () => {
    const profile = { ...createThorne().roleplayProfile, tone: [] };
    expect(CHARACTER_FIELDS.roleplayProfile.safeParse(profile).success).toBe(false);
  });
});

describe("правка листа проходит объявления полей", () => {
  const refusal = (patch: Record<string, unknown>): string => {
    try {
      Character.of(createThorne()).withSheet(patch);
    } catch (error: unknown) {
      return error instanceof DomainError ? error.message : String(error);
    }
    throw new Error("правка принята, а ожидался отказ");
  };

  it("характеристика вне диапазона не сохраняется", () => {
    const thorne = createThorne();
    expect(refusal({ abilities: { ...thorne.abilities, strength: 31 } })).toContain("abilities");
  });

  it("уровень вне диапазона и дробный не сохраняются", () => {
    expect(refusal({ level: 21 })).toContain("level");
    expect(refusal({ level: 7.5 })).toContain("level");
  });

  it("пустое имя не сохраняется", () => {
    expect(refusal({ name: "" })).toContain("name");
  });

  it("отрицательные возраст и скорость не сохраняются", () => {
    expect(refusal({ age: -1 })).toContain("age");
    expect(refusal({ speed: -5 })).toContain("speed");
  });

  it("дробная перебивка не сохраняется, а отрицательная сохраняется: минус бывает", () => {
    expect(refusal({ overrides: { saves: {}, skills: {}, initiative: 1.5 } })).toContain("overrides");
    expect(
      Character.of(createThorne())
        .withSheet({ overrides: { saves: {}, skills: {}, initiative: -1 } })
        .toState().overrides.initiative,
    ).toBe(-1);
  });

  it("правка, прошедшая объявления, доходит до состояния", () => {
    expect(Character.of(createThorne()).withSheet({ age: 142 }).toState().age).toBe(142);
  });

  it("частичная прибавка доходит до состояния разобранной, а не куском", () => {
    // Тип объявляет три поля, но патч, минующий типизированный вызов (импорт, ручная миграция),
    // способен принести и меньше — тот самый случай, который здесь проверяется.
    const partialMiscBonuses = { spellcasting: 3 } as ItemBonuses;
    const state = Character.of(createThorne())
      .withSheet({ miscBonuses: partialMiscBonuses })
      .toState();
    expect(state.miscBonuses).toEqual({ ...NO_ITEM_BONUSES, spellcasting: 3 });

    const sheet = Sheet.of(state);
    expect(Number.isNaN(sheet.spellSaveDc)).toBe(false);
    expect(Number.isNaN(sheet.savingThrow("strength"))).toBe(false);
  });
});
