import { describe, expect, it } from "vitest";
import { withSlotDebt, withSpentSlots } from "@/core/infrastructure/catalog/thorne/fixtures";

import { Sheet } from "@/core/domain/sheet/sheet";
import { characterStateSchema } from "@/core/domain/assembly/state";
import { undoLast, type Clock, type Session } from "@/core/application/session";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import {
  changeLevel,
  previewLevelChange,
  editAbility,
  editHealth,
  editIdentity,
  editMarks,
  editMiscBonuses,
  setArmorClassBaseOverride,
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

describe("предпросмотр смены уровня", () => {
  it("называет всё, что сдвинется: ячейки, руны, кости, лимит подготовки", () => {
    const preview = previewLevelChange(createThorne(), 9);

    expect(preview.changes).toContainEqual({ of: "slots", slotLevel: 4, before: 1, after: 3 });
    expect(preview.changes).toContainEqual({ of: "slots", slotLevel: 5, before: 0, after: 1 });
    expect(preview.changes).toContainEqual({ of: "hitDice", before: 7, after: 9 });
    expect(preview.changes).toContainEqual({ of: "preparedLimit", before: 11, after: 13 });
  });

  it("на своём уровне сдвигать нечего", () => {
    expect(previewLevelChange(createThorne(), 7).changes).toEqual([]);
  });

  it("руны следуют бонусу мастерства, а не уровню", () => {
    expect(previewLevelChange(createThorne(), 8).changes).not.toContainEqual(
      expect.objectContaining({ of: "runes" }),
    );
    expect(previewLevelChange(createThorne(), 9).changes).toContainEqual({
      of: "runes",
      before: 3,
      after: 4,
    });
  });

  it("дневной бюджет восстановления сдвигается вместе с ячейками", () => {
    // Половина уровня вверх: 4 на седьмом, 5 на девятом.
    expect(previewLevelChange(createThorne(), 9).changes).toContainEqual({
      of: "arcaneRecovery",
      before: 4,
      after: 5,
    });
  });

  it("перебитый лимит подготовки за уровнем не идёт, и сдвига ему не обещают", () => {
    const overridden = setOverride(session(), "preparedLimit", 20, clock).character;

    const preview = previewLevelChange(overridden, 9);

    expect(preview.changes).not.toContainEqual(
      expect.objectContaining({ of: "preparedLimit" }),
    );
    expect(preview.changes).toContainEqual({ of: "hitDice", before: 7, after: 9 });
  });

  it("отказ владельца назван причиной: обещать при нём нечего", () => {
    const indebted = withSlotDebt(createThorne(), 1);

    const preview = previewLevelChange(indebted, 9);

    expect(preview.refusal).toBe("Ячеек 1 уровня: осталось -1 при максимуме 4");
    expect(preview.changes).toEqual([]);
    expect(preview.hitPoints).toBeNull();
  });

  it("прибавка хитов названа слагаемыми: среднее за кость и Телосложение", () => {
    // У Торна d6 (среднее 4) и Телосложение 16 (+3).
    expect(previewLevelChange(createThorne(), 8).hitPoints).toEqual({
      perDie: 4,
      dieSize: 6,
      constitution: 3,
      total: 7,
    });
  });

  it("без костей хитов прибавку назвать нечем: чужая выгрузка могла их не знать", () => {
    const { hitDice: _absent, ...withoutDice } = createThorne();
    expect(previewLevelChange(withoutDice, 8).hitPoints).toBeNull();
  });
});

describe("смена уровня", () => {
  it("максимумы растут, новая ячейка приходит неистраченной", () => {
    const base = session();
    const spent = { ...base, character: withSpentSlots(base.character, 4, 1) };

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
    const spent = {
      ...session(),
      character: { ...session().character, arcaneRecovery: { maximum: 4, remaining: 1 } },
    };
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
    const base = session();
    const before: Session = {
      ...base,
      character: { ...base.character, skills: { stealth: "proficient" } },
    };

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

  it("прочие прибавки правятся с листа и двигают КС заклинаний", () => {
    const blessed = editMiscBonuses(
      session(),
      { spellcasting: 3, armorClass: 2, savingThrows: 1 },
      clock,
    );
    // 8 + 3 (мастерство) + 4 (Интеллект) + 3 (прочие) + 1 (фокусировка).
    expect(Sheet.of(blessed.character).spellSaveDc).toBe(19);
    expect(blessed.journal[0]?.summaryRu).toBe("Правка прочих прибавок");

    const undone = undoLast(blessed);
    expect(undone.character.miscBonuses).toEqual({ spellcasting: 0, armorClass: 0, savingThrows: 0 });
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

  it("перебивка базы КД ставится, снимается и проверяет значение", () => {
    const set = setArmorClassBaseOverride(session(), 14, clock);
    expect(Sheet.of(set.character).armorClassParts.base).toBe(14);
    expect(Sheet.of(set.character).armorClassParts.baseOverridden).toBe(true);
    expect(set.journal[0]?.summaryRu).toBe("База Класса Доспеха: 14");

    const cleared = setArmorClassBaseOverride(set, null, clock);
    expect(Sheet.of(cleared.character).armorClassParts.baseOverridden).toBe(false);
    expect(cleared.journal.at(-1)?.summaryRu).toBe("База Класса Доспеха: по надетому");
  });

  it("база КД: нецелое или отрицательное отклоняется", () => {
    expect(() => setArmorClassBaseOverride(session(), 10.5, clock)).toThrow();
    expect(() => setArmorClassBaseOverride(session(), -1, clock)).toThrow();
  });
});
