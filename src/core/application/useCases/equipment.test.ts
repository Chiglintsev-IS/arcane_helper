import { describe, expect, it } from "vitest";

import { Sheet } from "@/core/domain/sheet/sheet";
import { Equipment } from "@/core/domain/equipment/equipment";
import { Items } from "@/core/domain/items/items";
import { undoLast, type Clock } from "@/core/application/session";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { addItem, adjustBagCount, adjustWornCount, editItem, editMoney, removeItem } from "./equipment";

const session = () => ({ character: createThorne(), journal: [] });

function testClock(): Clock {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 7, 2, 12, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
  };
}

const clock = testClock();
const ring = { nameRu: "Кольцо защиты", kind: "gear" as const };
const RING_ID = Items.idFromName(ring.nameRu);
const potions = { nameRu: "Зелье лечения", kind: "consumable" as const };
const POTION_ID = Items.idFromName(potions.nameRu);

describe("правка снаряжения", () => {
  it("одноимённая находка пополняет запас, и журнал называет получившееся количество", () => {
    const stacked = addItem(addItem(session(), potions, clock), potions, clock);

    expect(Equipment.of(stacked.character).bagCount(POTION_ID)).toBe(2);
    expect(stacked.journal[0]?.summaryRu).toBe("Добавлено: Зелье лечения (стало 1)");
    expect(stacked.journal[1]?.summaryRu).toBe("Добавлено: Зелье лечения (стало 2)");
    // Пополнение обратимо, как всякая правка: запас возвращается к прежнему числу.
    expect(Equipment.of(undoLast(stacked).character).bagCount(POTION_ID)).toBe(1);
  });

  it("правка вещи меняет её саму и обратима через журнал (FR-235)", () => {
    const carried = addItem(session(), ring, clock);
    const noted = editItem(carried, { id: RING_ID, nameRu: ring.nameRu, kind: "gear", note: "фамильное" }, clock);

    const item = Items.of(noted.character).find(RING_ID);
    expect(item?.note).toBe("фамильное");
    expect(noted.journal[1]?.summaryRu).toBe("Правка вещи: Кольцо защиты");
    expect(Items.of(undoLast(noted).character).find(RING_ID)?.note).toBeUndefined();
  });

  it("надетая вещь двигает КД и спасброски, но не характеристики", () => {
    const bonusedRing = {
      id: RING_ID,
      nameRu: ring.nameRu,
      kind: "gear" as const,
      bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
    };
    const carried = editItem(addItem(session(), ring, clock), bonusedRing, clock);
    const after = adjustWornCount(carried, RING_ID, 1, clock);
    const sheet = Sheet.of(after.character);

    // Торн уже носит мантию и плащ защиты (по +1 к КД каждый): к их прибавке добавляется кольцо.
    expect(sheet.armorClassParts).toEqual({
      base: 10,
      baseOverridden: false,
      baseFormula: 10,
      dexterityModifier: 2,
      itemBonus: 3,
      miscBonus: 0,
    });
    expect(sheet.savingThrow("constitution")).toBe(5);
    expect(after.character.abilities.constitution).toBe(16);
  });

  it("снятая вещь перестаёт считаться, отмена возвращает надетой", () => {
    const bonusedRing = {
      id: RING_ID,
      nameRu: ring.nameRu,
      kind: "gear" as const,
      bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 0 },
    };
    const worn = adjustWornCount(editItem(addItem(session(), ring, clock), bonusedRing, clock), RING_ID, 1, clock);
    const removedFromBody = adjustWornCount(worn, RING_ID, -1, clock);

    // Снятое кольцо перестаёт считаться: остаётся только прибавка уже надетой мантии и плаща.
    expect(Sheet.of(removedFromBody.character).armorClassParts.itemBonus).toBe(2);
    expect(removedFromBody.journal.at(-1)?.summaryRu).toBe("Снято: Кольцо защиты");
    expect(Sheet.of(undoLast(removedFromBody).character).armorClassParts.itemBonus).toBe(3);
  });

  it("надевание лежащего в сумке названо своим словом", () => {
    const carried = addItem(session(), ring, clock);
    expect(adjustWornCount(carried, RING_ID, 1, clock).journal.at(-1)?.summaryRu).toBe("Надето: Кольцо защиты");
  });

  it("вещь убирается только когда её запас пуст, и это своя запись журнала", () => {
    const added = addItem(session(), ring, clock);
    const emptied = adjustBagCount(added, RING_ID, -1, clock);
    const gone = removeItem(emptied, RING_ID, clock);

    expect(Items.of(gone.character).find(RING_ID)).toBeUndefined();
    expect(gone.journal.at(-1)?.summaryRu).toBe("Убрано: Кольцо защиты");
  });

  it("вещь с непустым запасом не убирается, отказ называет причину", () => {
    const added = addItem(session(), ring, clock);
    expect(() => removeItem(added, RING_ID, clock)).toThrow(/сперва потратьте или снимите весь запас/);
  });

  it("неизвестная вещь отвергается доменом", () => {
    expect(() => removeItem(session(), "нет-такой", clock)).toThrow(/нет среди заведённых/);
    expect(() => adjustWornCount(session(), "нет-такой", 1, clock)).toThrow(/нет среди заведённых/);
    expect(() => adjustBagCount(session(), "нет-такой", -1, clock)).toThrow(/столько не потратить/);
  });

  it("расход тратит по одной, журнал называет остаток в сумке, отмена возвращает (FR-239)", () => {
    const withThree = adjustBagCount(addItem(session(), potions, clock), POTION_ID, 2, clock);
    const spent = adjustBagCount(withThree, POTION_ID, -1, clock);

    expect(Equipment.of(spent.character).bagCount(POTION_ID)).toBe(2);
    expect(spent.journal.at(-1)?.summaryRu).toBe("Потрачено: Зелье лечения (в сумке 2)");

    const undone = undoLast(spent);
    expect(Equipment.of(undone.character).bagCount(POTION_ID)).toBe(3);
  });

  it("последний экземпляр оставляет вещь нулём: кончилось — не то же, что выброшено (FR-239)", () => {
    const single = addItem(session(), potions, clock);
    const spent = adjustBagCount(single, POTION_ID, -1, clock);

    expect(Equipment.of(spent.character).bagCount(POTION_ID)).toBe(0);
    expect(spent.journal.at(-1)?.summaryRu).toBe("Потрачено: Зелье лечения (в сумке 0)");
  });

  it("пополнение — то же приращение с другим словом (FR-239)", () => {
    const stacked = addItem(session(), potions, clock);
    const refilled = adjustBagCount(stacked, POTION_ID, 2, clock);

    expect(Equipment.of(refilled.character).bagCount(POTION_ID)).toBe(3);
    expect(refilled.journal.at(-1)?.summaryRu).toBe("Пополнено: Зелье лечения (в сумке 3)");
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

  it("надетый доспех двигает базу КД сам, снятие возвращает базу без доспехов", () => {
    const chainmail = { nameRu: "Кольчуга", kind: "gear" as const };
    const chainmailId = Items.idFromName(chainmail.nameRu);
    const armored = editItem(
      addItem(session(), chainmail, clock),
      { id: chainmailId, nameRu: chainmail.nameRu, kind: "gear", armorBase: 16 },
      clock,
    );
    const worn = adjustWornCount(armored, chainmailId, 1, clock);
    expect(Sheet.of(worn.character).armorClassParts.base).toBe(16);

    const takenOff = adjustWornCount(worn, chainmailId, -1, clock);
    expect(Sheet.of(takenOff.character).armorClassParts.base).toBe(10);
  });
});
