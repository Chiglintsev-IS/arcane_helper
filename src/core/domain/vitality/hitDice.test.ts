import { DomainError } from "@/core/domain/shared/errors";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

import {
  hitDiceHealing,
  hitDiceLabel,
  hitDiceRegainedOnLongRest,
  maximumHitDiceForCast,
} from "@/core/domain/vitality/hitDice";

describe("возврат костей хитов долгим отдыхом (FR-134)", () => {
  it("возвращает половину, округляя вниз", () => {
    expect(hitDiceRegainedOnLongRest(7)).toBe(3);
    expect(hitDiceRegainedOnLongRest(8)).toBe(4);
  });

  it("одну кость возвращает всегда: округление вниз не должно давать ноль", () => {
    expect(hitDiceRegainedOnLongRest(1)).toBe(1);
  });

  it("отказывает бессмысленному числу костей", () => {
    expect(() => hitDiceRegainedOnLongRest(0)).toThrow(DomainError);
    expect(() => hitDiceRegainedOnLongRest(2.5)).toThrow(DomainError);
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
    //, но у нашего персонажа обязано быть — иначе «Вне боя» нечего показать.
    const thorne = createThorne();
    expect(thorne.hitDice).toEqual({ total: thorne.level, size: 6, remaining: thorne.level });
    expect(hitDiceLabel(thorne.hitDice)).toBe("7d6");
  });
});

describe("сколько костей даёт бросить заклинание (FR-135)", () => {
  /** «Мистическая бодрость»: две кости ячейкой своего уровня, плюс две за каждый уровень выше. */
  const cost = { maximumDice: 2, extraDicePerSlotLevel: 2, addsSpellcastingModifier: true };

  it("ячейкой своего уровня даёт базовое число", () => {
    expect(maximumHitDiceForCast(cost, 2, 2, 7)).toBe(2);
  });

  it("каждый уровень ячейки выше добавляет свои кости", () => {
    expect(maximumHitDiceForCast(cost, 2, 3, 7)).toBe(4);
    expect(maximumHitDiceForCast(cost, 2, 4, 7)).toBe(6);
  });

  it("остаток режет сверху: нельзя бросить больше, чем есть", () => {
    expect(maximumHitDiceForCast(cost, 2, 4, 2)).toBe(2);
  });

  it("без неистраченных костей бросать нечего", () => {
    expect(maximumHitDiceForCast(cost, 2, 2, 0)).toBe(0);
  });

  it("ячейка ниже уровня заклинания не уменьшает базовое число", () => {
    // В интерфейсе такой ячейки не выбрать, но схема импорта её не запрещает, а отрицательный
    // множитель дал бы максимум меньше базового.
    expect(maximumHitDiceForCast(cost, 2, 1, 7)).toBe(2);
  });

  it("заклинание без роста от ячейки не растёт", () => {
    const flat = { maximumDice: 3, extraDicePerSlotLevel: 0, addsSpellcastingModifier: false };
    expect(maximumHitDiceForCast(flat, 1, 4, 7)).toBe(3);
  });
});

describe("лечение по брошенным костям (FR-135, ADR-0021)", () => {
  const cost = { maximumDice: 2, extraDicePerSlotLevel: 2, addsSpellcastingModifier: true };

  it("прибавляет модификатор один раз, сколько бы костей ни бросили", () => {
    expect(hitDiceHealing(cost, 9, 4)).toBe(13);
  });

  it("заклинание без модификатора лечит ровно на выпавшее", () => {
    expect(hitDiceHealing({ ...cost, addsSpellcastingModifier: false }, 9, 4)).toBe(9);
  });
});
