import { describe, expect, it } from "vitest";

import { Character } from "@/core/domain/assembly/character";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { PermanentContribution } from "@/core/domain/character/schema";
import { saveStatId, skillStatId } from "@/core/domain/shared/stats";

import { Sheet } from "./sheet";

const sheetOf = (state: CharacterState = createThorne()) => Character.of(state).sheet;

/** Персонаж с постоянными вкладами: то, чем прежде были перебивка и прочая прибавка. */
function withPermanent(...permanent: PermanentContribution[]): CharacterState {
  return { ...createThorne(), permanentContributions: permanent };
}

const assigned = (stat: PermanentContribution["contribution"]["stat"], value: number) => ({
  nameRu: "Слово мастера",
  contribution: { stat, kind: "assignment", value } as const,
});

const granted = (stat: PermanentContribution["contribution"]["stat"], value: number) => ({
  nameRu: "Благословение",
  contribution: { stat, kind: "bonus", value } as const,
});

describe("производные числа листа", () => {
  it("числа Торна сходятся с листом персонажа без единого постоянного вклада", () => {
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
    // Без доспехов: 10 + Ловкость 2 + мантия 1 + плащ 1.
    expect(sheet.value("armorClass")).toBe(14);
    expect(sheet.value(skillStatId("arcana"))).toBe(7);
    expect(sheet.value(skillStatId("investigation"))).toBe(7);
    expect(sheet.value(skillStatId("nature"))).toBe(7);
    expect(sheet.value(skillStatId("perception"))).toBe(4);
    expect(sheet.value("passivePerception")).toBe(14);
  });

  it("постоянные вклады персонажа складываются с надетым", () => {
    const blessed = sheetOf(
      withPermanent(granted("spellSaveDc", 2), granted(saveStatId("constitution"), 1)),
    );
    // КС 16 = 8 + 3 + 4 + 1 (фокусировка); благословение +2 поверх.
    expect(blessed.value("spellSaveDc")).toBe(18);
    // Спасбросок Телосложения 4 = 3 + 1 (плащ); дар +1 поверх.
    expect(blessed.value(saveStatId("constitution"))).toBe(5);
  });

  it("инициатива двигается за Мудростью, а не только за Ловкостью", () => {
    const state = createThorne();
    // Ловкость 14 (+2), Мудрость 16 (+3): (2 + 3) ÷ 2 вниз.
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
    const assignedSheet = sheetOf(
      withPermanent(assigned("spellSaveDc", 18), assigned(saveStatId("constitution"), 9)),
    );
    expect(assignedSheet.value("spellSaveDc")).toBe(18);
    expect(assignedSheet.value(saveStatId("constitution"))).toBe(9);
    expect(assignedSheet.value("spellAttackModifier")).toBe(8);
  });

  it("назначенный бонус мастерства доходит до КС, атаки, спасбросков и навыков", () => {
    const assignedSheet = sheetOf(withPermanent(assigned("proficiencyBonus", 5)));

    expect(assignedSheet.value("proficiencyBonus")).toBe(5);
    expect(assignedSheet.value(saveStatId("intelligence"))).toBe(10);
    expect(assignedSheet.value(skillStatId("arcana"))).toBe(9);
    // КС и атака заклинаний читают назначенный бонус, а не пересчитывают его из уровня.
    expect(assignedSheet.value("spellSaveDc")).toBe(18);
    expect(assignedSheet.value("spellAttackModifier")).toBe(10);
  });

  it("назначение навыка перекрывает счёт по владению", () => {
    const state = withPermanent(assigned(skillStatId("arcana"), 12));
    expect(sheetOf({ ...state, skills: { arcana: "proficient" } }).value(skillStatId("arcana"))).toBe(
      12,
    );
  });

  it("правка Интеллекта двигает КС, атаку и лимит подготовки", () => {
    const state = createThorne();
    const smarter = sheetOf({ ...state, abilities: { ...state.abilities, intelligence: 20 } });
    expect(smarter.value("spellSaveDc")).toBe(17);
    expect(smarter.value("spellAttackModifier")).toBe(9);
    expect(smarter.value("preparedLimit")).toBe(12);
  });

  it("действующее число не совпадает с одним основанием, и разница видна в разборе", () => {
    // Одно основание без вкладов — 10 + Ловкость; надетое прибавляет ещё два.
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
    // Без доспехов 14 = 10 + 2 + вещи 2; с «Доспехами мага» 13 + 2 + 2 = 17.
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
    const state = withPermanent(assigned("armorClass", 19));
    expect(Character.of(state).sheetWith(shield).value("armorClass")).toBe(19);
  });
});

describe("лист без принесённых вкладов", () => {
  it("считает одно основание: вклады — дело того, кто их собрал", () => {
    expect(Sheet.of(createThorne(), []).value("armorClass")).toBe(12);
  });
});
