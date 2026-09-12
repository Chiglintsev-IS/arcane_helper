import { describe, expect, it } from "vitest";

import type { Apparatus } from "./apparatus";
import { researchPlan } from "./research";

const TORN_KIT: Apparatus = "Надёжный походный комплект";

const LABORATORY: Apparatus = "Профессиональный лабораторный модуль";

const plan = (number: number, apparatus: Apparatus = TORN_KIT) =>
  researchPlan({ number, apparatus });

describe("исследование ингредиента", () => {
  it("третье свойство требует стационарной лаборатории", () => {
    expect(() => plan(3)).toThrow(/под номером 3 исследуют только в стационарной/);
    expect(() => plan(4)).toThrow(/под номером 4 исследуют только в стационарной/);

    const deep = plan(3, LABORATORY);
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

    expect(() =>
      researchPlan({ number: 4, apparatus: "Базовый лабораторный модуль" }),
    ).toThrow(/Сложность исследования 25 выше предела оснащения 20/);
  });

  it("без набора точного исследования не бывает", () => {
    expect(() => researchPlan({ number: 1, apparatus: undefined })).toThrow(
      /без набора/,
    );
  });

  it("глубже четвёртого свойства исследовать нечего", () => {
    expect(() => plan(5, LABORATORY)).toThrow(/Глубже четвёртого/);
  });
});
