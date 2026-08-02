import { describe, expect, it } from "vitest";

import {
  cantripDamageAtCharacterLevel,
  damageAtSlotLevel,
  effectiveDamage,
  upcastChangesDamage,
  type DamageSpec,
} from "@/core/domain/catalog/scaling";

/** «Волшебная стрела»: 3d4+3 базово, по дротику за каждый уровень выше первого. */
const magicMissile: DamageSpec = {
  dice: "3d4+3",
  type: "сила",
  scaling: { 2: "4d4+4", 3: "5d4+5", 4: "6d4+6" },
};

/** «Луч холода»: заговор, пороги уровня персонажа 5, 11 и 17. */
const rayOfFrost: DamageSpec = {
  dice: "1d8",
  type: "холод",
  scaling: { 5: "2d8", 11: "3d8", 17: "4d8" },
};

/** «Развеивание магии»: повышение уровня не меняет урона — урона нет вовсе. */
const noDamage: DamageSpec = { dice: "—", type: "нет" };

describe("damageAtSlotLevel", () => {
  it.each([
    [1, "3d4+3"],
    [2, "4d4+4"],
    [3, "5d4+5"],
    [4, "6d4+6"],
  ])("ячейка %i уровня даёт %s", (slotLevel, expected) => {
    expect(damageAtSlotLevel(magicMissile, slotLevel)).toBe(expected);
  });

  it("возвращает базовую формулу для уровня без записи в таблице", () => {
    expect(damageAtSlotLevel(magicMissile, 9)).toBe("3d4+3");
    expect(damageAtSlotLevel(noDamage, 3)).toBe("—");
  });
});

describe("cantripDamageAtCharacterLevel", () => {
  it.each([
    [1, "1d8"],
    [4, "1d8"],
    [5, "2d8"],
    [7, "2d8"],
    [10, "2d8"],
    [11, "3d8"],
    [16, "3d8"],
    [17, "4d8"],
    [20, "4d8"],
  ])("уровень персонажа %i даёт %s", (characterLevel, expected) => {
    expect(cantripDamageAtCharacterLevel(rayOfFrost, characterLevel)).toBe(expected);
  });

  it("возвращает базовую формулу у заговора без масштабирования", () => {
    expect(cantripDamageAtCharacterLevel(noDamage, 20)).toBe("—");
  });
});

describe("effectiveDamage", () => {
  it("для заговора считает от уровня персонажа, игнорируя ячейку", () => {
    expect(
      effectiveDamage(rayOfFrost, { spellLevel: 0, slotLevel: 4, characterLevel: 7 }),
    ).toBe("2d8");
  });

  it("для заклинания считает от ячейки, игнорируя уровень персонажа", () => {
    expect(
      effectiveDamage(magicMissile, { spellLevel: 1, slotLevel: 3, characterLevel: 7 }),
    ).toBe("5d4+5");
  });
});

describe("upcastChangesDamage", () => {
  it("сообщает об изменении урона при повышении", () => {
    expect(upcastChangesDamage(magicMissile, 1, 3)).toBe(true);
  });

  it("не считает изменением сотворение своим уровнем", () => {
    expect(upcastChangesDamage(magicMissile, 1, 1)).toBe(false);
  });

  it("не обещает изменения там, где урон не масштабируется", () => {
    expect(upcastChangesDamage(noDamage, 3, 4)).toBe(false);
    expect(upcastChangesDamage(magicMissile, 1, 9)).toBe(false);
  });
});
