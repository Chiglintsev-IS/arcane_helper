import { describe, expect, it } from "vitest";

import { Sheet } from "@/core/domain/sheet/sheet";
import { undoLast, type Clock } from "@/core/application/session";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import {
  addItem,
  editArmorClassBase,
  editItem,
  editOtherBonuses,
  removeItem,
  spendItem,
  toggleWorn,
} from "./equipment";

const session = () => ({ character: createThorne(), journal: [] });

function testClock(): Clock {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 7, 2, 12, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
  };
}

const clock = testClock();
const ring = {
  id: "ring",
  nameRu: "Кольцо защиты",
  worn: true,
  count: 1,
  bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
};
const potions = { id: "healing-potion", nameRu: "Зелье лечения", worn: false, count: 3, kind: "potion" as const };

describe("правка снаряжения", () => {
  it("одноимённая находка пополняет запас, и журнал называет получившееся количество", () => {
    const stacked = addItem(addItem(session(), potions, clock), { ...potions, count: 1 }, clock);

    expect(stacked.character.equipment.items.find((item) => item.id === potions.id)?.count).toBe(4);
    expect(stacked.journal[0]?.summaryRu).toBe("Добавлено: Зелье лечения");
    expect(stacked.journal[1]?.summaryRu).toBe("Добавлено: Зелье лечения (стало 4)");
    // Пополнение обратимо, как всякая правка: запас возвращается к прежнему числу.
    expect(
      undoLast(stacked).character.equipment.items.find((item) => item.id === potions.id)?.count,
    ).toBe(3);
  });

  it("правка вещи меняет её саму и обратима через журнал (FR-235)", () => {
    const carried = addItem(session(), { ...ring, worn: false }, clock);
    const noted = editItem(carried, { ...ring, worn: false, count: 2, note: "фамильное" }, clock);

    const item = noted.character.equipment.items.find((candidate) => candidate.id === "ring");
    expect(item?.note).toBe("фамильное");
    expect(item?.count).toBe(2);
    expect(noted.journal[1]?.summaryRu).toBe("Правка вещи: Кольцо защиты");
    expect(
      undoLast(noted).character.equipment.items.find((candidate) => candidate.id === "ring")?.note,
    ).toBeUndefined();
  });

  it("надетая вещь двигает КД и спасброски, но не характеристики", () => {
    const after = addItem(session(), ring, clock);
    const sheet = Sheet.of(after.character);

    expect(sheet.armorClassParts).toEqual({ base: 10, dexterityModifier: 2, itemBonus: 3 });
    expect(sheet.savingThrow("constitution")).toBe(5);
    expect(after.character.abilities.constitution).toBe(16);
    expect(after.journal).toHaveLength(1);
  });

  it("снятая вещь перестаёт считаться, отмена возвращает надетой", () => {
    const worn = addItem(session(), ring, clock);
    const removedFromBody = toggleWorn(worn, "ring", clock);

    expect(Sheet.of(removedFromBody.character).armorClassParts.itemBonus).toBe(2);
    expect(removedFromBody.journal[1]?.summaryRu).toBe("Снято: Кольцо защиты");
    expect(Sheet.of(undoLast(removedFromBody).character).armorClassParts.itemBonus).toBe(3);
  });

  it("надевание лежащего в сумке названо своим словом", () => {
    const carried = addItem(session(), { ...ring, worn: false }, clock);
    expect(toggleWorn(carried, "ring", clock).journal[1]?.summaryRu).toBe("Надето: Кольцо защиты");
  });

  it("вещь убирается, и это своя запись журнала", () => {
    const added = addItem(session(), ring, clock);
    const gone = removeItem(added, "ring", clock);

    expect(gone.character.equipment.items.some((item) => item.id === "ring")).toBe(false);
    expect(gone.journal[1]?.summaryRu).toBe("Убрано: Кольцо защиты");
  });

  it("неизвестная вещь отвергается доменом, а подпись не выдумывает имени", () => {
    expect(() => removeItem(session(), "нет-такой", clock)).toThrow(/нет в инвентаре/);
    expect(() => toggleWorn(session(), "нет-такой", clock)).toThrow(/нет в инвентаре/);
    expect(() => spendItem(session(), "нет-такой", clock)).toThrow(/нет в инвентаре/);
  });

  it("вещь тратится по одной, и это обратимо через журнал", () => {
    const stacked = addItem(session(), potions, clock);
    const spent = spendItem(stacked, "healing-potion", clock);

    expect(spent.character.equipment.items.find((item) => item.id === "healing-potion")?.count).toBe(2);
    expect(spent.journal.at(-1)?.summaryRu).toBe("Потрачено: Зелье лечения");

    const undone = undoLast(spent);
    expect(undone.character.equipment.items.find((item) => item.id === "healing-potion")?.count).toBe(3);
  });

  it("последний экземпляр расходуется вместе с вещью, и отмена возвращает её", () => {
    const single = addItem(session(), { ...potions, count: 1 }, clock);
    const spent = spendItem(single, "healing-potion", clock);

    expect(spent.character.equipment.items.some((item) => item.id === "healing-potion")).toBe(false);

    const undone = undoLast(spent);
    expect(undone.character.equipment.items.find((item) => item.id === "healing-potion")?.count).toBe(1);
  });

  it("база Класса Доспеха правится и доходит до итога", () => {
    const armored = editArmorClassBase(session(), 15, clock);
    expect(Sheet.of(armored.character).armorClassParts.base).toBe(15);
    expect(armored.journal[0]?.summaryRu).toBe("База Класса Доспеха: 15");
  });

  it("прибавки без вещи двигают КС заклинаний", () => {
    const richer = editOtherBonuses(
      session(),
      { spellcasting: 3, armorClass: 2, savingThrows: 1 },
      clock,
    );
    // 8 + 3 (мастерство) + 4 (Интеллект) + 3 (без вещи) + 1 (фокусировка).
    expect(Sheet.of(richer.character).spellSaveDc).toBe(19);
    expect(richer.journal[0]?.summaryRu).toBe("Правка прибавок без вещи");
  });
});
