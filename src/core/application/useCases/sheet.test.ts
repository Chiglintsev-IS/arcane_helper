import { describe, expect, it } from "vitest";

import { Sheet } from "@/core/domain/sheet/sheet";
import { characterStateSchema } from "@/core/domain/character/state";
import { undoLast, type Clock } from "@/core/application/session";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import {
  changeLevel,
  editAbility,
  editHealth,
  editIdentity,
  editMarks,
  setOverride,
} from "./sheet";

const session = () => ({ character: createThorne(), journal: [] });

/** Детерминированные часы: чистые функции время не изобретают. */
function testClock(): Clock {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 7, 2, 12, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
  };
}

const clock = testClock();

describe("смена уровня", () => {
  it("максимумы растут, новая ячейка приходит неистраченной", () => {
    const spent = session();
    spent.character.spellSlots[4] = { maximum: 1, remaining: 0 };

    const after = changeLevel(spent, { level: 8, hitPointMaximumBase: 66 }, clock);

    expect(after.character.level).toBe(8);
    expect(after.character.spellSlots[4]).toEqual({ maximum: 2, remaining: 1 });
    expect(after.character.hitDice?.total).toBe(8);
    expect(after.character.hitPoints.maximumBase).toBe(66);
    expect(Sheet.of(after.character).preparationLimit).toBe(12);
  });

  it("понижение обрезает остаток и убирает исчезнувший уровень ячеек", () => {
    const after = changeLevel(session(), { level: 6, hitPointMaximumBase: 54 }, clock);
    expect(after.character.spellSlots[4]).toBeUndefined();
    expect(after.character.hitDice?.remaining).toBe(6);
  });

  it("одна запись журнала, и отмена возвращает и лист, и ресурсы", () => {
    const before = session();
    const after = changeLevel(before, { level: 8, hitPointMaximumBase: 66 }, clock);
    expect(after.journal).toHaveLength(1);

    const undone = undoLast(after);
    expect(undone.character.level).toBe(7);
    expect(undone.character.spellSlots[4]).toEqual({ maximum: 1, remaining: 1 });
    expect(undone.character.hitPoints.maximumBase).toBe(60);
  });

  it("руны следуют за бонусом мастерства", () => {
    const after = changeLevel(session(), { level: 9, hitPointMaximumBase: 72 }, clock);
    expect(after.character.runes).toEqual({ maximum: 4, remaining: 4 });
  });

  it("бюджет магического восстановления следует за уровнем", () => {
    const after = changeLevel(session(), { level: 9, hitPointMaximumBase: 72 }, clock);
    // ceil(9 / 2) = 5, а остаток был полным — двигается вместе с максимумом.
    expect(after.character.arcaneRecovery).toEqual({ maximum: 5, remaining: 5 });
  });

  it("частично потраченный бюджет двигается на разницу максимумов, а не сбрасывается", () => {
    const spent = session();
    spent.character.arcaneRecovery = { maximum: 4, remaining: 1 };
    const after = changeLevel(spent, { level: 9, hitPointMaximumBase: 72 }, clock);
    expect(after.character.arcaneRecovery).toEqual({ maximum: 5, remaining: 2 });
  });

  it("подготовку сверх нового лимита понижение уровня не снимает", () => {
    const before = session();
    const preparedCount = before.character.preparedSpellIds.length;

    const after = changeLevel(before, { level: 5, hitPointMaximumBase: 45 }, clock);

    expect(after.character.preparedSpellIds).toHaveLength(preparedCount);
    expect(Sheet.of(after.character).preparationLimit).toBe(9);
  });
});

describe("правка листа", () => {
  it("характеристика записывается в журнал и меняет производные", () => {
    const after = editAbility(
      session(),
      { ability: "intelligence", score: 20, saveProficient: true, skills: {} },
      clock,
    );
    expect(after.journal).toHaveLength(1);
    expect(Sheet.of(after.character).spellSaveDc).toBe(17);
  });

  it("правка одной характеристики не трогает соседние и чужие навыки", () => {
    const before = session();
    before.character.skills = { stealth: "proficient" };

    const after = editAbility(
      before,
      { ability: "intelligence", score: 20, saveProficient: true, skills: { arcana: "expert" } },
      clock,
    );

    expect(after.character.abilities.strength).toBe(8);
    expect(after.character.skills).toEqual({ stealth: "proficient", arcana: "expert" });
  });

  it("владение спасброском снимается и ставится, порядок остаётся листовым", () => {
    const dropped = editAbility(
      session(),
      { ability: "wisdom", score: 12, saveProficient: false, skills: {} },
      clock,
    );
    expect(dropped.character.saveProficiencies).toEqual(["intelligence"]);

    const added = editAbility(
      dropped,
      { ability: "strength", score: 8, saveProficient: true, skills: {} },
      clock,
    );
    expect(added.character.saveProficiencies).toEqual(["strength", "intelligence"]);
  });

  it("справочные поля журнала не создают", () => {
    const after = editIdentity(session(), { age: 142, species: "Лунный тролль" });
    expect(after.journal).toHaveLength(0);
    expect(after.character.age).toBe(142);
  });

  it("отметки мастера записываются", () => {
    const after = editMarks(session(), { exhaustion: 2, inspiration: true }, clock);
    expect(after.character.exhaustion).toBe(2);
    expect(after.journal).toHaveLength(1);
  });

  it("снятое истощение записывается общей подписью", () => {
    const after = editMarks(session(), { exhaustion: 0, inspiration: true }, clock);
    expect(after.journal[0]?.summaryRu).toBe("Отметки мастера изменены");
  });

  it("перебивка ставится и снимается", () => {
    const set = setOverride(session(), "spellSaveDc", 18, clock);
    expect(Sheet.of(set.character).spellSaveDc).toBe(18);
    const cleared = setOverride(set, "spellSaveDc", null, clock);
    expect(Sheet.of(cleared.character).spellSaveDc).toBe(16);
  });

  it("здоровье правится базой и снижением мастера", () => {
    const after = editHealth(session(), { maximumBase: 70, masterReduction: 10 }, clock);
    expect(after.character.hitPoints).toEqual({
      current: 60,
      maximumBase: 70,
      bloodReduction: 0,
      masterReduction: 10,
    });
    expect(after.journal[0]?.summaryRu).toBe("Максимум хитов: 60");
  });

  it("недопустимая характеристика отвергается схемой, состояние не тронуто", () => {
    const before = session();
    expect(() =>
      characterStateSchema.parse(
        editAbility(before, { ability: "strength", score: 0, saveProficient: false, skills: {} }, clock)
          .character,
      ),
    ).toThrow();
    expect(before.character.abilities.strength).toBe(8);
  });
});
