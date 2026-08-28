import { saveStatId } from "@/core/domain/shared/stats";
import { describe, expect, it } from "vitest";

import { z } from "zod";

import { CHARACTER_FIELDS } from "@/core/domain/character/schema";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { Character } from "@/core/domain/assembly/character";
import { DomainError } from "@/core/domain/shared/errors";

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
    // Владения волшебника из «Книги игрока»: доспехами класс не владеет вовсе.
    expect(thorneState.proficiencies.weapons).toContain("Боевой посох");
    expect(thorneState.proficiencies.armor).toEqual([]);
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

  it("причина дробного отказа звучит по-русски целиком, без слова библиотеки внутри фразы", () => {
    // Круг ревью до этого поймал ровно то, что здесь и проверяется: «int» словаря zod, оставшийся
    // непереведённым внутри уже русской фразы («ожидалось int, получено число»).
    expect(refusal({ level: 7.5 })).toBe(
      "Поле «level» не годится: Неверный ввод: ожидалось целое число, получено число",
    );
  });

  it("причина отказа для числа вне диапазона тоже звучит по-русски целиком", () => {
    const thorne = createThorne();
    expect(refusal({ abilities: { ...thorne.abilities, strength: 31 } })).toBe(
      "Поле «abilities» не годится: Слишком большое значение: ожидалось, что число будет <=30",
    );
  });

  it("пустое имя не сохраняется, и причина звучит по-русски целиком", () => {
    expect(refusal({ name: "" })).toBe(
      'Поле «name» не годится: Слишком маленькое значение: ожидалось, что строка будет иметь >=1 символ',
    );
  });

  it("отрицательные возраст и скорость не сохраняются", () => {
    expect(refusal({ age: -1 })).toContain("age");
    expect(refusal({ speed: -5 })).toContain("speed");
  });


  it("правка, прошедшая объявления, доходит до состояния", () => {
    expect(Character.of(createThorne()).withSheet({ age: 142 }).toState().age).toBe(142);
  });

  it("правка доходит до состояния разобранной, а не куском", () => {
    // Патч, минующий типизированный вызов (импорт, ручная миграция), способен принести неполное
    // поле — тот самый случай, который здесь проверяется.
    const partial: Record<string, unknown> = { skills: { arcana: "expert" } };
    const state = Character.of(createThorne()).withSheet(partial).toState();
    expect(state.skills).toEqual({ arcana: "expert" });

    const sheet = Character.of(state).sheet;
    expect(Number.isNaN(sheet.value("spellSaveDc"))).toBe(false);
    expect(Number.isNaN(sheet.value(saveStatId("strength")))).toBe(false);
  });
});
