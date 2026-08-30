import { Character } from "@/core/domain/assembly/character";
import { saveStatId } from "@/core/domain/shared/stats";
import { describe, expect, it } from "vitest";

import { Equipment } from "@/core/domain/equipment/equipment";
import { Items } from "@/core/domain/items/items";
import { undoLast, type Occasion } from "@/core/application/session";
import { ALL_TURN_RESOURCES, checkAvailability } from "@/core/application/casting/availability";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import {
  addItem,
  adjustBagCount,
  adjustWornCount,
  editItem,
  editMoney,
  removeItem,
  recordItem,
  toggleWanted,
} from "./equipment";

const session = () => ({ character: createThorne(), log: [] });

function testOccasion(commandId = "command-1"): Occasion {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 7, 2, 12, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
    commandId,
  };
}

const occasion = testOccasion();
const ring = { nameRu: "Кольцо защиты", kinds: ["gear"] as const };
const RING_ID = Items.idFromName(ring.nameRu);
const potions = { nameRu: "Зелье лечения", kinds: ["consumable"] as const };
const POTION_ID = Items.idFromName(potions.nameRu);

const FOCUS_ID =
  Items.of(createThorne()).all.filter((item) => item.spellcastingFocus === true)[0]?.id ?? "";

function spellCard(id: string): Spell {
  const found = loadThorneSpells().find((spell) => spell.id === id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

const mageArmor = spellCard("mage-armor");

describe("правка снаряжения", () => {
  it("одноимённая находка пополняет запас, и лог называет получившееся количество", () => {
    const stacked = addItem(addItem(session(), potions, occasion), potions, occasion);

    expect(Equipment.of(stacked.character).bagCount(POTION_ID)).toBe(2);
    expect(stacked.log[0]?.summaryRu).toBe("Добавлено: Зелье лечения (стало 1)");
    expect(stacked.log[1]?.summaryRu).toBe("Добавлено: Зелье лечения (стало 2)");
    expect(Equipment.of(undoLast(stacked).character).bagCount(POTION_ID)).toBe(1);
  });

  it("правка вещи меняет её саму и обратима через лог (FR-235)", () => {
    const carried = addItem(session(), ring, occasion);
    const noted = editItem(carried, { id: RING_ID, nameRu: ring.nameRu, kinds: ["gear"], note: "фамильное" }, occasion);

    const item = Items.of(noted.character).find(RING_ID);
    expect(item?.note).toBe("фамильное");
    expect(noted.log[1]?.summaryRu).toBe("Правка вещи: Кольцо защиты");
    expect(Items.of(undoLast(noted).character).find(RING_ID)?.note).toBeUndefined();
  });

  it("надетая вещь двигает КД и спасброски, но не характеристики", () => {
    const bonusedRing = {
      id: RING_ID,
      nameRu: ring.nameRu,
      kinds: ["gear"] as const,
      bonuses: { armorClass: 1, "save:constitution": 1 },
    };
    const carried = editItem(addItem(session(), ring, occasion), bonusedRing, occasion);
    const after = adjustWornCount(carried, RING_ID, 1, occasion);
    const sheet = Character.of(after.character).sheet;

    expect(sheet.value("armorClass")).toBe(15);
    expect(sheet.value(saveStatId("constitution"))).toBe(5);
    expect(after.character.abilities.constitution).toBe(16);
  });

  it("снятая вещь перестаёт считаться, отмена возвращает надетой", () => {
    const bonusedRing = {
      id: RING_ID,
      nameRu: ring.nameRu,
      kinds: ["gear"] as const,
      bonuses: { armorClass: 1 },
    };
    const worn = adjustWornCount(editItem(addItem(session(), ring, occasion), bonusedRing, occasion), RING_ID, 1, occasion);
    const removedFromBody = adjustWornCount(worn, RING_ID, -1, occasion);

    expect(Character.of(removedFromBody.character).sheet.value("armorClass")).toBe(14);
    expect(removedFromBody.log.at(-1)?.summaryRu).toBe("Снято: Кольцо защиты");
    expect(Character.of(undoLast(removedFromBody).character).sheet.value("armorClass")).toBe(15);
  });

  it("надевание лежащего в сумке названо своим словом", () => {
    const carried = addItem(session(), ring, occasion);
    expect(adjustWornCount(carried, RING_ID, 1, occasion).log.at(-1)?.summaryRu).toBe("Надето: Кольцо защиты");
  });

  it("вещь убирается только когда её запас пуст, и это своя запись лога", () => {
    const added = addItem(session(), ring, occasion);
    const emptied = adjustBagCount(added, RING_ID, -1, occasion);
    const gone = removeItem(emptied, RING_ID, occasion);

    expect(Items.of(gone.character).find(RING_ID)).toBeUndefined();
    expect(gone.log.at(-1)?.summaryRu).toBe("Убрано: Кольцо защиты");
  });

  it("покупка заводит вещь без запаса, и желание снимается тем же переключателем", () => {
    const wished = recordItem(session(), "Верёвка", true, occasion);
    const id = Items.idFromName("Верёвка");

    expect(Items.of(wished.character).find(id)?.kinds).toEqual([]);
    expect(Equipment.of(wished.character).bagCount(id)).toBe(0);
    expect(Equipment.of(wished.character).wants(id)).toBe(true);
    expect(wished.log[0]?.summaryRu).toBe("В покупки: Верёвка");

    const bought = toggleWanted(wished, id, occasion);
    expect(Equipment.of(bought.character).wants(id)).toBe(false);
    expect(bought.log[1]?.summaryRu).toBe("Из покупок: Верёвка");
    expect(Equipment.of(undoLast(bought).character).wants(id)).toBe(true);
  });

  it("встреченную вещь записывают без запаса и без желания её купить", () => {
    const noted = recordItem(session(), "Зелье невидимости", false, occasion);
    const id = Items.idFromName("Зелье невидимости");

    expect(Items.of(noted.character).find(id)?.nameRu).toBe("Зелье невидимости");
    expect(Equipment.of(noted.character).bagCount(id)).toBe(0);
    expect(Equipment.of(noted.character).wants(id)).toBe(false);
    expect(noted.log[0]?.summaryRu).toBe("Записано: Зелье невидимости");
  });

  it("желание вещи, которой нет среди заведённых, лог называет её идентификатором", () => {
    const wished = toggleWanted(session(), "неведомое", occasion);
    expect(wished.log[0]?.summaryRu).toBe("В покупки: неведомое");
  });

  it("убранная вещь уходит и из покупок", () => {
    const wished = recordItem(session(), "Верёвка", true, occasion);
    const id = Items.idFromName("Верёвка");
    const removed = removeItem(wished, id, occasion);

    expect(Items.of(removed.character).find(id)).toBeUndefined();
    expect(Equipment.of(removed.character).wants(id)).toBe(false);
  });

  it("вещь с непустым запасом не убирается, отказ называет причину", () => {
    const added = addItem(session(), ring, occasion);
    expect(() => removeItem(added, RING_ID, occasion)).toThrow(/сперва потратьте или снимите весь запас/);
  });

  it("запас вещи, которой нет среди заведённых, отказ называет её идентификатором", () => {
    const stocked = adjustBagCount(session(), "призрак", 1, occasion);
    expect(() => removeItem(stocked, "призрак", occasion)).toThrow(/«призрак»/);
  });

  it("неизвестная вещь отвергается доменом", () => {
    expect(() => removeItem(session(), "нет-такой", occasion)).toThrow(/нет среди заведённых/);
    expect(() => adjustWornCount(session(), "нет-такой", 1, occasion)).toThrow(/нет среди заведённых/);
    expect(() => adjustBagCount(session(), "нет-такой", -1, occasion)).toThrow(/столько не потратить/);
  });

  it("расход тратит по одной, лог называет остаток в сумке, отмена возвращает (FR-239)", () => {
    const withThree = adjustBagCount(addItem(session(), potions, occasion), POTION_ID, 2, occasion);
    const spent = adjustBagCount(withThree, POTION_ID, -1, occasion);

    expect(Equipment.of(spent.character).bagCount(POTION_ID)).toBe(2);
    expect(spent.log.at(-1)?.summaryRu).toBe("Потрачено: Зелье лечения (в сумке 2)");

    const undone = undoLast(spent);
    expect(Equipment.of(undone.character).bagCount(POTION_ID)).toBe(3);
  });

  it("последний экземпляр оставляет вещь нулём: кончилось — не то же, что выброшено (FR-239)", () => {
    const single = addItem(session(), potions, occasion);
    const spent = adjustBagCount(single, POTION_ID, -1, occasion);

    expect(Equipment.of(spent.character).bagCount(POTION_ID)).toBe(0);
    expect(spent.log.at(-1)?.summaryRu).toBe("Потрачено: Зелье лечения (в сумке 0)");
  });

  it("пополнение — то же приращение с другим словом (FR-239)", () => {
    const stacked = addItem(session(), potions, occasion);
    const refilled = adjustBagCount(stacked, POTION_ID, 2, occasion);

    expect(Equipment.of(refilled.character).bagCount(POTION_ID)).toBe(3);
    expect(refilled.log.at(-1)?.summaryRu).toBe("Пополнено: Зелье лечения (в сумке 3)");
  });

  it("кошелёк правится итогом, лог называет только сдвинувшиеся монеты (FR-242)", () => {
    const paid = editMoney(session(), { gold: 215, silver: 30, copper: 0 }, occasion);

    expect(paid.character.equipment.money.gold).toBe(215);
    expect(paid.log[0]?.summaryRu).toBe("Деньги: зм 0 → 215, см 0 → 30");

    const undone = undoLast(paid);
    expect(undone.character.equipment.money.gold).toBe(0);
  });

  it("правка кошелька без изменений так и называется", () => {
    const same = editMoney(session(), { gold: 0, silver: 0, copper: 0 }, occasion);
    expect(same.log[0]?.summaryRu).toBe("Деньги: без изменений");
  });

  it("снятая фокусировка возвращает требование материала", () => {
    const componentReasons = (character: CharacterState): string[] =>
      checkAvailability({
        spell: mageArmor,
        character,
        turn: ALL_TURN_RESOURCES,
        mode: "normal",
        payment: { kind: "slot", slotLevel: 1 },
      })
        .warnings.filter((warning) => warning.code === "no_component")
        .map((warning) => warning.reasonRu);

    const worn = session();
    expect(componentReasons(worn.character)).toEqual([]);

    const stowed = adjustWornCount(worn, FOCUS_ID, -1, occasion);
    expect(componentReasons(stowed.character)[0]).toContain("кусок обработанной кожи");

    expect(componentReasons(undoLast(stowed).character)).toEqual([]);
  });

  it("надетая вещь двигает КД прибавкой, снятие возвращает прежнее число", () => {
    const chainmail = { nameRu: "Кольчуга", kinds: ["gear"] as const };
    const chainmailId = Items.idFromName(chainmail.nameRu);
    const armored = editItem(
      addItem(session(), chainmail, occasion),
      { id: chainmailId, nameRu: chainmail.nameRu, kinds: ["gear"], bonuses: { armorClass: 6 } },
      occasion,
    );
    const worn = adjustWornCount(armored, chainmailId, 1, occasion);
    expect(Character.of(worn.character).sheet.value("armorClass")).toBe(20);

    const takenOff = adjustWornCount(worn, chainmailId, -1, occasion);
    expect(Character.of(takenOff.character).sheet.value("armorClass")).toBe(14);
  });
});
