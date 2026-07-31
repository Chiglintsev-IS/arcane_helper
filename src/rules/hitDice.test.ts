import { describe, expect, it } from "vitest";

import { createThorne } from "@/data/content/thorne/character";

import { RulesError } from "./abilities";
import { hitDiceLabel, hitDiceRegainedOnLongRest } from "./hitDice";

describe("возврат костей хитов долгим отдыхом (FR-134)", () => {
  it("возвращает половину, округляя вниз", () => {
    expect(hitDiceRegainedOnLongRest(7)).toBe(3);
    expect(hitDiceRegainedOnLongRest(8)).toBe(4);
  });

  it("одну кость возвращает всегда: округление вниз не должно давать ноль", () => {
    expect(hitDiceRegainedOnLongRest(1)).toBe(1);
  });

  it("отказывает бессмысленному числу костей", () => {
    expect(() => hitDiceRegainedOnLongRest(0)).toThrow(RulesError);
    expect(() => hitDiceRegainedOnLongRest(2.5)).toThrow(RulesError);
  });
});

describe("остаток костей хитов словами (FR-134)", () => {
  it("полный пул пишется как в листе персонажа", () => {
    expect(hitDiceLabel({ total: 7, size: 6, remaining: 7 })).toBe("7d6");
  });

  it("после трат называет и остаток, и исходное", () => {
    expect(hitDiceLabel({ total: 7, size: 6, remaining: 5 })).toBe("5d6 из 7");
  });

  it("состояние без костей молчать не должно: их могло не быть в чужой выгрузке", () => {
    expect(hitDiceLabel(undefined)).toBe("не заведены");
  });
});

describe("кости хитов Торна", () => {
  it("одна за уровень, размер по классу волшебника", () => {
    // Проверка живёт здесь, а не в схеме: поле необязательное ради импорта чужих выгрузок
    // (FR-121), но у нашего персонажа обязано быть — иначе «Вне боя» нечего показать.
    const thorne = createThorne();
    expect(thorne.hitDice).toEqual({ total: thorne.level, size: 6, remaining: thorne.level });
    expect(hitDiceLabel(thorne.hitDice)).toBe("7d6");
  });
});
