import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import { Items } from "@/core/domain/items/items";
import type { ItemDefinition } from "@/core/domain/items/schema";

const rope: ItemDefinition = { id: "rope", nameRu: "Верёвка", kinds: [] };

describe("вещи", () => {
  it("заводит вещь: id выводится из имени", () => {
    const items = Items.of({ itemDefinitions: [] }).addDefinition({ nameRu: "Верёвка", kinds: [] });
    expect(items.find("верёвка")?.nameRu).toBe("Верёвка");
  });

  it("одноимённая вещь второй записи не заводит", () => {
    const once = Items.of({ itemDefinitions: [] }).addDefinition({ nameRu: "Верёвка", kinds: [] });
    const twice = once.addDefinition({ nameRu: "Верёвка", kinds: [] });
    expect(twice.all).toHaveLength(1);
  });

  it("переименование меняет имя, а личность вещи оставляет на месте", () => {
    const renamed = Items.of({ itemDefinitions: [rope] }).replaceDefinition({
      ...rope,
      nameRu: "Шёлковая верёвка",
    });

    expect(renamed.find("rope")?.nameRu).toBe("Шёлковая верёвка");
    expect(renamed.all).toHaveLength(1);
  });

  it("переименование в занятое имя отклоняется с причиной", () => {
    const both = Items.of({ itemDefinitions: [rope, { id: "cord", nameRu: "Бечёвка", kinds: [] }] });

    expect(() => both.replaceDefinition({ id: "cord", nameRu: "верёвка", kinds: [] })).toThrow(
      DomainError,
    );
    expect(() => both.replaceDefinition({ id: "cord", nameRu: "верёвка", kinds: [] })).toThrow(
      /уже заведена/,
    );
  });

  it("повторное заведение дописывает названный признак заведённой вещи", () => {
    const once = Items.of({ itemDefinitions: [] }).addDefinition({
      nameRu: "Верёвка",
      kinds: ["gear"],
    });
    const twice = once.addDefinition({ nameRu: "Верёвка", kinds: ["consumable"] });
    expect(twice.all).toHaveLength(1);
    expect(twice.find("верёвка")?.kinds).toEqual(["gear", "consumable"]);
  });

  it("правка вещи целиком заменяет запись, соседей не трогает", () => {
    const items = Items.of({ itemDefinitions: [rope, { id: "torch", nameRu: "Факел", kinds: [] }] });
    const renamed = items.replaceDefinition({ ...rope, nameRu: "Прочная верёвка" });
    expect(renamed.find("rope")?.nameRu).toBe("Прочная верёвка");
    expect(renamed.find("torch")?.nameRu).toBe("Факел");
  });

  it("правка незаведённой вещи отвергается с причиной", () => {
    expect(() => Items.of({ itemDefinitions: [] }).replaceDefinition(rope)).toThrow(DomainError);
  });

  it("правка со снятием экипировки оставляет прибавку действовать при себе", () => {
    const armored: ItemDefinition = {
      id: "ring",
      nameRu: "Кольцо защиты",
      kinds: ["gear"],
      spellcastingFocus: true,
      bonuses: { armorClass: 1 },
    };
    const items = Items.of({ itemDefinitions: [armored] });
    const moved = items.replaceDefinition({ ...armored, kinds: [] });
    expect(moved.find("ring")).toEqual({
      id: "ring",
      nameRu: "Кольцо защиты",
      kinds: [],
      bonuses: { armorClass: 1 },
      worksCarried: true,
    });
  });

  it("убирает вещь, соседей не трогает", () => {
    const items = Items.of({ itemDefinitions: [rope, { id: "torch", nameRu: "Факел", kinds: [] }] });
    const removed = items.removeDefinition("rope");
    expect(removed.find("rope")).toBeUndefined();
    expect(removed.find("torch")).toBeDefined();
  });

  it("убрать незаведённую вещь отвергается с причиной", () => {
    expect(() => Items.of({ itemDefinitions: [] }).removeDefinition("rope")).toThrow(DomainError);
  });

  it("id по имени: строчными, пробелы дефисом", () => {
    expect(Items.idFromName("Магическая фокусировка +1")).toBe("магическая-фокусировка-+1");
  });

  it("toState отдаёт собранное состояние контекста", () => {
    const items = Items.of({ itemDefinitions: [rope] });
    expect(items.toState()).toEqual({ itemDefinitions: [rope] });
  });
});

describe("алхимия ингредиента у вещи", () => {
  const herb = { id: "herb", nameRu: "Лунная трава", kinds: ["ingredient"] as const };
  const rope = { id: "rope", nameRu: "Верёвка", kinds: [] as const };
  const bench = (): Items => Items.of({ itemDefinitions: [herb, rope] });

  it("свойство раскрывается у вещи и стоит под своим номером", () => {
    const known = bench().revealProperty("herb", { number: 1, nameRu: "Лечение здоровья" });

    expect(known.alchemyOf("herb").properties).toEqual([
      { number: 1, nameRu: "Лечение здоровья" },
    ]);
    expect(known.alchemyOf("herb").propertiesExhausted).toBe(false);
  });

  it("отметка «свойств больше нет» ставится и снимается", () => {
    const marked = bench().markPropertiesExhausted("herb", true);

    expect(marked.alchemyOf("herb").propertiesExhausted).toBe(true);
    expect(marked.markPropertiesExhausted("herb", false).alchemyOf("herb").propertiesExhausted).toBe(
      false,
    );
  });

  it("наблюдения живут по одному: пишутся, правятся и убираются по отдельности", () => {
    const seen = bench()
      .noteObservation("herb", { id: "one", textRu: "Пахнет тиной" })
      .noteObservation("herb", { id: "two", textRu: "Растёт у брода" });

    expect(seen.alchemyOf("herb").observations).toHaveLength(2);

    const fixed = seen.rewriteObservation("herb", "one", "Пахнет болотом");
    expect(fixed.alchemyOf("herb").observations[0]?.textRu).toBe("Пахнет болотом");

    const dropped = fixed.dropObservation("herb", "two");
    expect(dropped.alchemyOf("herb").observations.map((one) => one.id)).toEqual(["one"]);
  });

  it("наблюдение отклоняется по занятой и по чужой идентичности", () => {
    const seen = bench().noteObservation("herb", { id: "one", textRu: "Тина" });

    expect(() => seen.noteObservation("herb", { id: "one", textRu: "Ещё" })).toThrow(
      /уже записано/,
    );
    expect(() => seen.dropObservation("herb", "нет-такого")).toThrow(/нет наблюдения/);
    expect(() => seen.rewriteObservation("herb", "нет-такого", "Ещё")).toThrow(/нет наблюдения/);
  });

  it("алхимии не спрашивают ни у незаведённой вещи, ни у той, что не ингредиент", () => {
    expect(() => bench().alchemyOf("нет-такой")).toThrow(/нет среди заведённых/);
    expect(() => bench().alchemyOf("rope")).toThrow(/не ингредиент/);
  });

  it("ингредиенты отбираются признаком", () => {
    expect(bench().ingredients.map((item) => item.id)).toEqual(["herb"]);
  });

  it("снятый признак ингредиента уносит алхимию: свойств у неингредиента не бывает", () => {
    const known = bench().revealProperty("herb", { number: 1, nameRu: "Лечение здоровья" });
    const plain = known.replaceDefinition({ ...known.find("herb")!, kinds: [] });

    expect(plain.find("herb")?.alchemy).toBeUndefined();
  });
});
