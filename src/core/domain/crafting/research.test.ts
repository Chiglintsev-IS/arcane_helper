import { describe, expect, it } from "vitest";

import type { Apparatus } from "./apparatus";
import { researchPlan } from "./research";

const TORN_KIT: Apparatus = "Надёжный походный комплект";

const LABORATORY: Apparatus = "Профессиональный лабораторный модуль";

const plan = (number: number, apparatus: Apparatus = TORN_KIT) =>
  researchPlan({ number, apparatus });

describe("исследование ингредиента", () => {
  it("походному комплекту третье свойство не по силам, но цена названа и ему", () => {
    const outside = plan(3);

    expect([outside.minutes, outside.difficulty]).toEqual([480, 18]);
    expect(outside.requirementRu).toMatch(/Нужен стационарный набор: записан «Надёжный/);

    const deep = plan(3, LABORATORY);
    expect(deep.requirementRu).toBeNull();
    expect([deep.minutes, deep.difficulty, deep.portionsOnFailure]).toEqual([480, 18, 2]);

    const deepest = plan(4, LABORATORY);
    expect([deepest.minutes, deepest.difficulty, deepest.portionsOnSuccess]).toEqual([1440, 25, 3]);
  });

  it("первое свойство раскрывают сырой пробой или анализом, и порция теряется лишь при провале", () => {
    const first = plan(1);

    expect([first.minutes, first.difficulty]).toEqual([10, 5]);
    expect([first.portionsOnSuccess, first.portionsOnFailure]).toEqual([0, 1]);
    expect(first.rawSampleRu).toContain("ослабленному проявлению");
    expect([first.consumablesRu, first.consumablesGold]).toEqual([null, 0]);
  });

  it("со второго свойства идут расходники по классу сложности за каждый начатый час", () => {
    const second = plan(2);

    expect([second.minutes, second.difficulty]).toEqual([60, 12]);
    expect([second.consumablesRu, second.consumablesGold]).toEqual(["Обычные", 1]);

    const fourth = plan(4, LABORATORY);
    expect([fourth.consumablesRu, fourth.consumablesGold]).toEqual(["Очищенные", 72]);
  });

  it("сложность растёт с глубиной и меряется пределом оснащения", () => {
    expect(researchPlan({ number: 2, apparatus: TORN_KIT }).difficulty).toBe(12);

    const shallow = researchPlan({ number: 4, apparatus: "Базовый лабораторный модуль" });

    expect(shallow.difficulty).toBe(25);
    expect(shallow.requirementRu).toMatch(/Нужен набор с пределом сложности от 25/);
  });

  it("без набора точного исследования не бывает, но чего оно стоит — сказано", () => {
    const barehanded = researchPlan({ number: 1, apparatus: undefined });

    expect(barehanded.difficulty).toBe(5);
    expect(barehanded.requirementRu).toMatch(/без набора/);
  });

  it("глубже четвёртого свойства исследовать нечего", () => {
    expect(() => plan(5, LABORATORY)).toThrow(/Глубже четвёртого/);
  });
});
