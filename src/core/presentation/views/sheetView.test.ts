/**
 * Проекция листа: наружу уходит посчитанное.
 *
 * Проверяется не пересказ полей, а то, ради чего проекция и заведена: числа приезжают сложенными
 * свёрткой, разбор объясняет их источниками, а слова правил едут словами правил — подписи выберет
 * показывающий.
 */

import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

import { toSheetView } from "./sheetView";

const thorne = () => toSheetView(createThorne());

/** Характеристика по имени: прогон называет их словами правил, а не местами в списке. */
function ability(id: string) {
  const found = thorne().abilities.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`нет характеристики ${id}`);
  return found;
}

describe("величины", () => {
  it("характеристики едут в порядке правил, каждая со своим модификатором", () => {
    expect(thorne().abilities.map((entry) => entry.id)).toEqual([
      "strength",
      "dexterity",
      "constitution",
      "intelligence",
      "wisdom",
      "charisma",
    ]);
    expect(ability("intelligence")).toMatchObject({ score: 18, modifier: 4 });
    expect(ability("strength")).toMatchObject({ score: 8, modifier: -1 });
  });

  it("спасбросок приезжает сложенным, а владение — признаком", () => {
    expect(ability("intelligence")).toMatchObject({ save: 8, saveProficient: true });
    expect(ability("strength")).toMatchObject({ save: 0, saveProficient: false });
  });

  it("навыки характеристики едут при ней вместе со степенью владения", () => {
    expect(ability("intelligence").skills).toContainEqual({
      id: "arcana",
      value: 7,
      training: "proficient",
    });
    // Нетренированный навык степени не несёт вовсе: пустое слово пришлось бы отличать от слова.
    expect(ability("intelligence").skills).toContainEqual({ id: "history", value: 4 });
  });

  it("все восемнадцать навыков разложены по своим характеристикам", () => {
    expect(thorne().abilities.flatMap((entry) => entry.skills)).toHaveLength(18);
  });
});

describe("разбор", () => {
  it("Класс Доспеха приезжает итогом, а из чего он сложился — не приезжает вовсе", () => {
    const state = createThorne();
    const armored = toSheetView({
      ...state,
      itemDefinitions: [
        ...state.itemDefinitions,
        { id: "scale-mail", nameRu: "Чешуйчатый доспех", kind: "gear" as const, armor: { base: 14 } },
      ],
      equipment: {
        ...state.equipment,
        worn: [...state.equipment.worn, { itemId: "scale-mail", count: 1 }],
      },
    });

    // Одно число, а не итог со слагаемыми: показывает его шапка «Игры», и разбирать его там нечем.
    expect(thorne().armorClass).toBe(14);
    expect(armored.armorClass).toBe(18);
  });
});

describe("здоровье", () => {
  it("максимум приезжает действующим, а снижения — своими числами", () => {
    const state = createThorne();
    const hurt = toSheetView({
      ...state,
      hitPoints: { current: 30, maximumBase: 60, bloodReduction: 6, masterReduction: 4 },
    });

    expect(hurt.hitPoints).toMatchObject({
      current: 30,
      maximum: 50,
      maximumBase: 60,
      bloodReduction: 6,
      masterReduction: 4,
    });
  });

  it("Костей хитов может не быть вовсе: состояние приехало из чужой сборки", () => {
    const { hitDice: _none, ...withoutDice } = createThorne();

    expect(toSheetView(withoutDice).hitPoints.hitDice).toBeUndefined();
    expect(thorne().hitPoints.hitDice).toEqual({ remaining: 7, total: 7, size: 6 });
  });
});

describe("кто он", () => {
  it("справочные поля и отметки мастера едут как есть", () => {
    expect(thorne()).toMatchObject({
      name: "Торн",
      species: "Лунный тролль",
      size: "medium",
      speed: 30,
      className: "Волшебник",
      level: 7,
      subclass: "Создатель рун",
      exhaustion: 0,
      inspiration: false,
    });
  });

  it("владения едут списками слов игрока", () => {
    const state = createThorne();
    const armed = toSheetView({
      ...state,
      proficiencies: { ...state.proficiencies, languages: ["Общий", "Великаний"] },
    });

    expect(armed.proficiencies.languages).toEqual(["Общий", "Великаний"]);
  });
});
