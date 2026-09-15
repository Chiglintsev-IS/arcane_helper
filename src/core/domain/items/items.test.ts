import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import { NO_ALCHEMY } from "@/core/domain/items/ingredient";
import { Items } from "@/core/domain/items/items";
import type { ItemDefinition } from "@/core/domain/items/schema";

const rope: ItemDefinition = { id: "rope", nameRu: "Верёвка", kinds: [], notes: [] };

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
    const both = Items.of({
      itemDefinitions: [rope, { id: "cord", nameRu: "Бечёвка", kinds: [], notes: [] }],
    });

    expect(() => both.replaceDefinition({ id: "cord", nameRu: "верёвка", kinds: [] })).toThrow(
      DomainError,
    );
    expect(() => both.replaceDefinition({ id: "cord", nameRu: "верёвка", kinds: [] })).toThrow(
      /уже заведена/,
    );
  });

  it("повторное заведение дописывает названный признак заведённой вещи", () => {
    const once = Items.of({ itemDefinitions: [] }).addDefinition({ nameRu: "Верёвка", kinds: [] });

    const named = once.addDefinition({ nameRu: "Верёвка", kinds: ["gear"] });
    expect(named.all).toHaveLength(1);
    expect(named.find("верёвка")?.kinds).toEqual(["gear"]);

    /* Названное второй раз ничего не дописывает: набор и так полон. */
    expect(named.addDefinition({ nameRu: "Верёвка", kinds: ["gear"] })).toBe(named);
  });

  it("правка вещи целиком заменяет запись, соседей не трогает", () => {
    const items = Items.of({
      itemDefinitions: [rope, { id: "torch", nameRu: "Факел", kinds: [], notes: [] }],
    });
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
      notes: [],
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
      notes: [],
      bonuses: { armorClass: 1 },
      worksCarried: true,
    });
  });

  it("переименование одним словом ничего больше о вещи не называет и не теряет", () => {
    const known = Items.of({ itemDefinitions: [{ ...rope, kinds: ["gear"], bonuses: { armorClass: 1 } }] })
      .addNote("rope", { id: "one", textRu: "Подгорела с краю" })
      .startAlchemy("rope");

    const renamed = known.rename("rope", "Шёлковая верёвка");

    expect(renamed.find("rope")).toMatchObject({
      nameRu: "Шёлковая верёвка",
      kinds: ["gear"],
      bonuses: { armorClass: 1 },
      notes: [{ id: "one", textRu: "Подгорела с краю" }],
    });
    expect(renamed.ingredients.map((item) => item.id)).toEqual(["rope"]);
  });

  it("убирает вещь, соседей не трогает", () => {
    const items = Items.of({
      itemDefinitions: [rope, { id: "torch", nameRu: "Факел", kinds: [], notes: [] }],
    });
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
  const herb = {
    id: "herb",
    nameRu: "Лунная трава",
    kinds: [] as const,
    notes: [],
    alchemy: NO_ALCHEMY,
  };
  const rope = { id: "rope", nameRu: "Верёвка", kinds: [] as const, notes: [] };
  const bench = (): Items => Items.of({ itemDefinitions: [herb, rope] });

  it("вид заводится записью, и второй раз она не заводится поверх раскрытого", () => {
    const plain = Items.of({ itemDefinitions: [rope] });
    expect(plain.ingredients).toEqual([]);

    const started = plain.startAlchemy("rope");
    expect(started.ingredients.map((item) => item.id)).toEqual(["rope"]);

    const known = started.revealProperty("rope", { number: 1, nameRu: "Лечение здоровья" });
    expect(known.startAlchemy("rope").alchemyOf("rope").properties).toHaveLength(1);
  });

  it("свойство раскрывается у вещи и стоит под своим номером", () => {
    const known = bench().revealProperty("herb", { number: 1, nameRu: "Лечение здоровья" });

    expect(known.alchemyOf("herb").properties).toEqual([
      { number: 1, nameRu: "Лечение здоровья" },
    ]);
  });

  it("раскрытое переписывается под своим номером, а пустому номеру переписывать нечего", () => {
    const known = bench().revealProperty("herb", { number: 1, nameRu: "Лечение здоровья" });
    const fixed = known.rewriteProperty("herb", {
      number: 1,
      nameRu: "Лечение ран",
      rarityRu: "Редкое",
    });

    expect(fixed.alchemyOf("herb").properties).toEqual([
      { number: 1, nameRu: "Лечение ран", rarityRu: "Редкое" },
    ]);
    expect(() =>
      known.rewriteProperty("herb", { number: 3, nameRu: "Взрыв" }),
    ).toThrow(/Лунная трава.*3/);
  });

  it("раскрытое убирается по номеру, а соседнее остаётся", () => {
    const known = bench()
      .revealProperty("herb", { number: 1, nameRu: "Лечение здоровья" })
      .revealProperty("herb", { number: 2, nameRu: "Пробуждение" });

    expect(known.dropProperty("herb", 1).alchemyOf("herb").properties).toEqual([
      { number: 2, nameRu: "Пробуждение" },
    ]);
  });

  it("под пустым номером убирать нечего: отказ называет вид и номер", () => {
    expect(() => bench().dropProperty("herb", 3)).toThrow(/Лунная трава.*3/);
  });

  it("правка вещи не называет алхимию и потому её не теряет", () => {
    const known = bench().revealProperty("herb", { number: 1, nameRu: "Лечение здоровья" });
    const renamed = known.replaceDefinition({
      id: "herb",
      nameRu: "Лунная травка",
      kinds: [],
    });

    expect(renamed.alchemyOf("herb").properties).toEqual([
      { number: 1, nameRu: "Лечение здоровья" },
    ]);
  });

  it("снятый признак ингредиента алхимию не уносит: раскрытое убирают своей операцией", () => {
    const known = bench().revealProperty("herb", { number: 1, nameRu: "Лечение здоровья" });
    const demoted = known.replaceDefinition({
      id: "herb",
      nameRu: "Лунная трава",
      kinds: ["gear"],
    });

    expect(demoted.find("herb")?.alchemy?.properties).toHaveLength(1);
    expect(demoted.ingredients.map((item) => item.id)).toEqual(["herb"]);
    expect(demoted.dropProperty("herb", 1).find("herb")?.alchemy?.properties).toHaveLength(0);
  });

  it("заметки живут по одной: пишутся, правятся и убираются по отдельности", () => {
    const written = bench()
      .addNote("herb", { id: "one", textRu: "Пахнет тиной" })
      .addNote("herb", { id: "two", textRu: "Растёт у брода" });

    expect(written.find("herb")?.notes).toHaveLength(2);

    const fixed = written.rewriteNote("herb", "one", "Пахнет болотом");
    expect(fixed.find("herb")?.notes[0]?.textRu).toBe("Пахнет болотом");

    const dropped = fixed.dropNote("herb", "two");
    expect(dropped.find("herb")?.notes.map((note) => note.id)).toEqual(["one"]);
  });

  it("заметку пишут и не ингредиенту: слова бывают о всякой вещи", () => {
    const written = bench().addNote("rope", { id: "one", textRu: "Подгорела с краю" });

    expect(written.find("rope")?.notes[0]?.textRu).toBe("Подгорела с краю");
  });

  it("заметка отклоняется по занятой и по чужой идентичности", () => {
    const written = bench().addNote("herb", { id: "one", textRu: "Тина" });

    expect(() => written.addNote("herb", { id: "one", textRu: "Ещё" })).toThrow(/уже записана/);
    expect(() => written.dropNote("herb", "нет-такой")).toThrow(/нет заметки/);
    expect(() => written.rewriteNote("herb", "нет-такой", "Ещё")).toThrow(/нет заметки/);
  });

  it("алхимии не спрашивают ни у незаведённой вещи, ни у той, что не ингредиент", () => {
    expect(() => bench().alchemyOf("нет-такой")).toThrow(/нет среди заведённых/);
    expect(() => bench().alchemyOf("rope")).toThrow(/не ингредиент/);
  });

  it("нераскрытые номера называются по порядку, без уже занятых", () => {
    const known = bench()
      .revealProperty("herb", { number: 1, nameRu: "Лечение здоровья" })
      .revealProperty("herb", { number: 3, nameRu: "Взрыв" });

    expect(known.unrevealedNumbers("herb")).toEqual([2, 4]);
  });

  it("ингредиенты отбираются признаком", () => {
    expect(bench().ingredients.map((item) => item.id)).toEqual(["herb"]);
  });

  it("вещь без единого признака остаётся видом алхимии, пока о ней записано знание", () => {
    const known = bench().revealProperty("herb", { number: 1, nameRu: "Лечение здоровья" });
    const plain = known.replaceDefinition({ ...known.find("herb")!, kinds: [] });

    expect(plain.find("herb")?.alchemy?.properties).toHaveLength(1);
    expect(plain.ingredients.map((item) => item.id)).toEqual(["herb"]);
  });
});
