import { describe, expect, it } from "vitest";

import { Character } from "@/core/domain/assembly/character";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import {
  saveStatId,
  skillStatId,
  type SourcedContribution,
  type StatId,
} from "@/core/domain/shared/stats";

import { Sheet } from "./sheet";

const sheetOf = (state: CharacterState = createThorne()) => Character.of(state).sheet;

const sheetBringing = (...brought: SourcedContribution[]) => Sheet.of(createThorne(), brought);

const assigned = (stat: StatId, value: number): SourcedContribution => ({
  source: { origin: "effect", nameRu: "Слово мастера" },
  contribution: { stat, kind: "assignment", value },
});

const granted = (stat: StatId, value: number): SourcedContribution => ({
  source: { origin: "effect", nameRu: "Благословение" },
  contribution: { stat, kind: "bonus", value },
});

describe("производные числа листа", () => {
  it("числа Торна сходятся с листом персонажа: одно основание и надетое", () => {
    const sheet = sheetOf();
    expect(sheet.value("proficiencyBonus")).toBe(3);
    expect(sheet.value("spellSaveDc")).toBe(16);
    expect(sheet.value("spellAttackModifier")).toBe(8);
    expect(sheet.value("preparedLimit")).toBe(11);
    expect(sheet.value("initiative")).toBe(1);
    expect(sheet.value(saveStatId("constitution"))).toBe(4);
    expect(sheet.value(saveStatId("intelligence"))).toBe(8);
    expect(sheet.value(saveStatId("wisdom"))).toBe(5);
    expect(sheet.value(saveStatId("strength"))).toBe(0);
    expect(sheet.value("armorClass")).toBe(14);
    expect(sheet.value(skillStatId("arcana"))).toBe(7);
    expect(sheet.value(skillStatId("investigation"))).toBe(7);
    expect(sheet.value(skillStatId("nature"))).toBe(7);
    expect(sheet.value(skillStatId("perception"))).toBe(4);
    expect(sheet.value("passivePerception")).toBe(14);
  });

  it("принесённые прибавки ложатся поверх основания", () => {
    const blessed = sheetBringing(granted("spellSaveDc", 2), granted(saveStatId("constitution"), 1));
    expect(blessed.value("spellSaveDc")).toBe(17);
    expect(blessed.value(saveStatId("constitution"))).toBe(4);
  });

  it("инициатива двигается за Мудростью, а не только за Ловкостью", () => {
    const state = createThorne();
    expect(
      sheetOf({ ...state, abilities: { ...state.abilities, wisdom: 16 } }).value("initiative"),
    ).toBe(2);
  });

  it("навык без владения — только модификатор характеристики", () => {
    expect(sheetOf().value(skillStatId("history"))).toBe(4);
  });

  it("владение навыком прибавляет бонус мастерства, компетентность — дважды", () => {
    const state = createThorne();
    expect(
      sheetOf({ ...state, skills: { arcana: "proficient" } }).value(skillStatId("arcana")),
    ).toBe(7);
    expect(sheetOf({ ...state, skills: { arcana: "expert" } }).value(skillStatId("arcana"))).toBe(
      10,
    );
  });

  it("назначение перекрывает формулу, соседнего числа не задевая", () => {
    const assignedSheet = sheetBringing(
      assigned("spellSaveDc", 18),
      assigned(saveStatId("constitution"), 9),
    );
    expect(assignedSheet.value("spellSaveDc")).toBe(18);
    expect(assignedSheet.value(saveStatId("constitution"))).toBe(9);
    expect(assignedSheet.value("spellAttackModifier")).toBe(7);
  });

  it("назначенный бонус мастерства доходит до КС, атаки, спасбросков и навыков", () => {
    const assignedSheet = sheetBringing(assigned("proficiencyBonus", 5));

    expect(assignedSheet.value("proficiencyBonus")).toBe(5);
    expect(assignedSheet.value(saveStatId("intelligence"))).toBe(9);
    expect(assignedSheet.value(skillStatId("arcana"))).toBe(9);
    expect(assignedSheet.value("spellSaveDc")).toBe(17);
    expect(assignedSheet.value("spellAttackModifier")).toBe(9);
  });

  it("назначение навыка перекрывает счёт по владению", () => {
    const trained = { ...createThorne(), skills: { arcana: "proficient" as const } };
    expect(
      Sheet.of(trained, [assigned(skillStatId("arcana"), 12)]).value(skillStatId("arcana")),
    ).toBe(12);
  });

  it("правка Интеллекта двигает КС, атаку и лимит подготовки", () => {
    const state = createThorne();
    const smarter = sheetOf({ ...state, abilities: { ...state.abilities, intelligence: 20 } });
    expect(smarter.value("spellSaveDc")).toBe(17);
    expect(smarter.value("spellAttackModifier")).toBe(9);
    expect(smarter.value("preparedLimit")).toBe(12);
  });

  it("действующее число не совпадает с одним основанием, и разница видна в разборе", () => {
    expect(Sheet.of(createThorne(), []).value("armorClass")).toBe(12);
    expect(sheetOf().value("armorClass")).toBe(14);
  });
});

describe("Класс Доспеха складывается той же свёрткой", () => {
  const mageArmor = {
    id: "mage-armor",
    nameRu: "Доспехи мага",
    contributions: [
      { stat: "armorClass", kind: "method", method: { family: "spell", base: 13 } },
    ],
  } as const;
  const shield = {
    id: "shield",
    nameRu: "Щит",
    contributions: [{ stat: "armorClass", kind: "bonus", value: 5 }],
  } as const;

  it("«Доспехи мага» и «Щит» действуют одновременно: способ счёта и прибавка не спорят", () => {
    const root = Character.of(createThorne());
    expect(root.sheet.value("armorClass")).toBe(14);
    expect(root.sheetWith(mageArmor).value("armorClass")).toBe(17);

    const armored = root.withEffects(
      root.effects.start(
        {
          id: "e-1",
          spellId: "mage-armor",
          nameRu: "Доспехи мага",
          startedAt: "2026-08-08T00:00:00.000Z",
          duration: { type: "hours", value: 8 },
          isConcentration: false,
          slotLevelUsed: 1,
          contributions: mageArmor.contributions,
          endConditionRu: "Держится 8 часов.",
        },
        "2026-08-08T00:00:00.000Z",
      ),
    );
    expect(armored.sheet.value("armorClass")).toBe(17);
    expect(armored.sheetWith(shield).value("armorClass")).toBe(22);
  });

  it("разбор называет каждый вклад его источником", () => {
    const parts = Character.of(createThorne()).sheet.breakdown("armorClass").parts;

    expect(parts.map((part) => part.source)).toContainEqual({ origin: "item", nameRu: "Мантия +1" });
    expect(parts.every((part) => part.applied)).toBe(true);
  });

  it("назначение перекрывает и доспех, и заклинание", () => {
    expect(
      Sheet.of(createThorne(), [
        assigned("armorClass", 19),
        { source: { origin: "effect", nameRu: "Щит" }, contribution: shield.contributions[0] },
      ]).value("armorClass"),
    ).toBe(19);
  });
});

describe("лист без принесённых вкладов", () => {
  it("считает одно основание: вклады — дело того, кто их собрал", () => {
    expect(Sheet.of(createThorne(), []).value("armorClass")).toBe(12);
  });
});
