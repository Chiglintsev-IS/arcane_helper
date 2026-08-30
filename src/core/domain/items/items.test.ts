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
