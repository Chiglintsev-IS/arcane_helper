import { describe, expect, it } from "vitest";

import { createWizard } from "@/core/infrastructure/catalog/thorne/fixtures";

import { toSheetView } from "./sheetView";

const wizard = () => toSheetView(createWizard());

function ability(id: string) {
  const found = wizard().abilities.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`нет характеристики ${id}`);
  return found;
}

describe("скорость листа приходит действующей (FR-334)", () => {
  function hastened() {
    const base = createWizard();
    return toSheetView({
      ...base,
      activeEffects: [
        {
          id: "effect-1",
          nameRu: "Руна ветра",
          startedAt: "2026-07-31T18:00:00.000Z",
          duration: { type: "rounds", value: 1 },
          isConcentration: false,
          slotLevelUsed: 2,
          contributions: [{ stat: "speed", kind: "bonus", value: 10 }],
          endConditionRu: "Держится до начала вашего следующего хода.",
        },
      ],
    });
  }

  it("прибавка видна тем же числом, каким по столу и ходят", () => {
    expect(hastened().speed).toBe(wizard().speed + 10);
  });

  it("правится при этом своя скорость: чужая прибавка в неё не запекается", () => {
    expect(hastened().speedBase).toBe(wizard().speedBase);
  });
});

describe("величины", () => {
  it("характеристики едут в порядке правил, каждая со своим модификатором", () => {
    expect(wizard().abilities.map((entry) => entry.id)).toEqual([
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
    expect(ability("intelligence").skills).toContainEqual({ id: "history", value: 4 });
  });

  it("все восемнадцать навыков разложены по своим характеристикам", () => {
    expect(wizard().abilities.flatMap((entry) => entry.skills)).toHaveLength(18);
  });

  it("бонус мастерства едет отдельным числом, хотя уже сложен в спасброски и навыки", () => {
    expect(wizard().proficiencyBonus).toBe(3);
    expect(toSheetView({ ...createWizard(), level: 9 }).proficiencyBonus).toBe(4);
  });
});

describe("разбор", () => {
  it("Класс Доспеха приезжает итогом, а из чего он сложился — не приезжает вовсе", () => {
    const state = createWizard();
    const armored = toSheetView({
      ...state,
      itemDefinitions: [
        ...state.itemDefinitions,
        {
          id: "bracers",
          nameRu: "Наручи защиты",
          kinds: ["gear"] as const,
          bonuses: { armorClass: 4 },
        },
      ],
      equipment: {
        ...state.equipment,
        worn: [...state.equipment.worn, { itemId: "bracers", count: 1 }],
      },
    });

    expect(wizard().armorClass).toBe(14);
    expect(armored.armorClass).toBe(18);
  });
});

describe("здоровье", () => {
  it("максимум приезжает действующим, а снижения — своими числами", () => {
    const state = createWizard();
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
    const { hitDice: _none, ...withoutDice } = createWizard();

    expect(toSheetView(withoutDice).hitPoints.hitDice).toBeUndefined();
    expect(wizard().hitPoints.hitDice).toEqual({ remaining: 7, total: 7, size: 6 });
  });
});

describe("кто он", () => {
  it("справочные поля и отметки мастера едут как есть", () => {
    expect(wizard()).toMatchObject({
      name: "Волшебник",
      species: "Тролль",
      size: "medium",
      speed: 30,
      className: "Волшебник",
      level: 7,
      subclass: "Рунист",
      exhaustion: 0,
      inspiration: false,
    });
  });

  it("владения едут списками слов игрока", () => {
    const state = createWizard();
    const armed = toSheetView({
      ...state,
      proficiencies: { ...state.proficiencies, languages: ["Общий", "Великаний"] },
    });

    expect(armed.proficiencies.languages).toEqual(["Общий", "Великаний"]);
  });
});
