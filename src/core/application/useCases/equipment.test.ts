import { describe, expect, it } from "vitest";

import { Sheet } from "@/core/domain/sheet/sheet";
import { undoLast, type Clock } from "@/core/application/session";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import {
  addItem,
  adjustItemCount,
  editArmorClassBase,
  editItem,
  editMoney,
  removeItem,
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
  kind: "gear" as const,
  worn: true,
  count: 1,
  bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
};
const potions = {
  id: "healing-potion",
  nameRu: "Зелье лечения",
  kind: "consumable" as const,
  worn: false,
  count: 3,
};

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

    expect(sheet.armorClassParts).toEqual({
      base: 10,
      dexterityModifier: 2,
      itemBonus: 3,
      miscBonus: 0,
    });
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
    expect(() => adjustItemCount(session(), "нет-такой", -1, clock)).toThrow(/нет в инвентаре/);
  });

  it("расход тратит по одной, журнал называет остаток, отмена возвращает (FR-239)", () => {
    const stacked = addItem(session(), potions, clock);
    const spent = adjustItemCount(stacked, "healing-potion", -1, clock);

    expect(spent.character.equipment.items.find((item) => item.id === "healing-potion")?.count).toBe(2);
    expect(spent.journal.at(-1)?.summaryRu).toBe("Потрачено: Зелье лечения (осталось 2)");

    const undone = undoLast(spent);
    expect(undone.character.equipment.items.find((item) => item.id === "healing-potion")?.count).toBe(3);
  });

  it("последний экземпляр оставляет вещь нулём: кончилось — не то же, что выброшено (FR-239)", () => {
    const single = addItem(session(), { ...potions, count: 1 }, clock);
    const spent = adjustItemCount(single, "healing-potion", -1, clock);

    const left = spent.character.equipment.items.find((item) => item.id === "healing-potion");
    expect(left?.count).toBe(0);
    expect(spent.journal.at(-1)?.summaryRu).toBe("Потрачено: Зелье лечения (осталось 0)");
  });

  it("пополнение — то же приращение с другим словом (FR-239)", () => {
    const stacked = addItem(session(), potions, clock);
    const refilled = adjustItemCount(stacked, "healing-potion", 2, clock);

    expect(refilled.character.equipment.items.find((item) => item.id === "healing-potion")?.count).toBe(5);
    expect(refilled.journal.at(-1)?.summaryRu).toBe("Пополнено: Зелье лечения (осталось 5)");
  });

  it("кошелёк правится итогом, журнал называет только сдвинувшиеся монеты (FR-242)", () => {
    const paid = editMoney(session(), { gold: 215, silver: 30, copper: 0 }, clock);

    expect(paid.character.equipment.money.gold).toBe(215);
    expect(paid.journal[0]?.summaryRu).toBe("Деньги: зм 0 → 215, см 0 → 30");

    const undone = undoLast(paid);
    expect(undone.character.equipment.money.gold).toBe(0);
  });

  it("правка кошелька без изменений так и называется", () => {
    const same = editMoney(session(), { gold: 0, silver: 0, copper: 0 }, clock);
    expect(same.journal[0]?.summaryRu).toBe("Деньги: без изменений");
  });

  it("база Класса Доспеха правится и доходит до итога", () => {
    const armored = editArmorClassBase(session(), 15, clock);
    expect(Sheet.of(armored.character).armorClassParts.base).toBe(15);
    expect(armored.journal[0]?.summaryRu).toBe("База Класса Доспеха: 15");
  });
});
