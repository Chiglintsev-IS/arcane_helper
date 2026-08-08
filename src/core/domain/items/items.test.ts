import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import { Items } from "@/core/domain/items/items";
import type { ItemDefinition } from "@/core/domain/items/schema";

const rope: ItemDefinition = { id: "rope", nameRu: "Верёвка", kind: "other" };

describe("вещи", () => {
  it("заводит вещь: id выводится из имени", () => {
    const items = Items.of({ itemDefinitions: [] }).addDefinition({ nameRu: "Верёвка", kind: "other" });
    expect(items.find("верёвка")?.nameRu).toBe("Верёвка");
  });

  it("одноимённая вещь той же категории повторно не заводится", () => {
    const once = Items.of({ itemDefinitions: [] }).addDefinition({ nameRu: "Верёвка", kind: "other" });
    const twice = once.addDefinition({ nameRu: "Верёвка", kind: "other" });
    expect(twice.all).toHaveLength(1);
  });

  it("одноимённая вещь другой категории отвергается с причиной (FR-241)", () => {
    const once = Items.of({ itemDefinitions: [] }).addDefinition({ nameRu: "Верёвка", kind: "other" });
    expect(() => once.addDefinition({ nameRu: "Верёвка", kind: "gear" })).toThrow(/другой категорией/);
  });

  it("правка вещи целиком заменяет запись, соседей не трогает", () => {
    const items = Items.of({ itemDefinitions: [rope, { id: "torch", nameRu: "Факел", kind: "other" }] });
    const renamed = items.replaceDefinition({ ...rope, nameRu: "Прочная верёвка" });
    expect(renamed.find("rope")?.nameRu).toBe("Прочная верёвка");
    expect(renamed.find("torch")?.nameRu).toBe("Факел");
  });

  it("правка незаведённой вещи отвергается с причиной", () => {
    expect(() => Items.of({ itemDefinitions: [] }).replaceDefinition(rope)).toThrow(DomainError);
  });

  it("правка со сменой категории снимает свойства экипировки, а не отвергает", () => {
    const armored: ItemDefinition = {
      id: "ring",
      nameRu: "Кольцо защиты",
      kind: "gear",
      bonuses: { armorClass: 1 },
    };
    const items = Items.of({ itemDefinitions: [armored] });
    const moved = items.replaceDefinition({ ...armored, kind: "other" });
    expect(moved.find("ring")).toEqual({ id: "ring", nameRu: "Кольцо защиты", kind: "other" });
  });

  it("убирает вещь, соседей не трогает", () => {
    const items = Items.of({ itemDefinitions: [rope, { id: "torch", nameRu: "Факел", kind: "other" }] });
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
