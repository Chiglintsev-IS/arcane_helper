import { describe, expect, it } from "vitest";

import { benefitsFromHigherSlot, effectiveDamage } from "@/core/domain/catalog/scaling";

/** «Волшебная стрела»: 3d4+3 базово, по дротику за каждый уровень выше первого. */
const magicMissile = {
  dice: "3d4+3",
  type: "сила",
  scaling: { 2: "4d4+4", 3: "5d4+5", 4: "6d4+6" },
};

/** «Луч холода»: заговор, пороги уровня персонажа 5, 11 и 17. */
const rayOfFrost = {
  dice: "1d8",
  type: "холод",
  scaling: { 5: "2d8", 11: "3d8", 17: "4d8" },
};

/** «Развеивание магии»: повышение уровня не меняет урона — урона нет вовсе. */
const noDamage = { dice: "—", type: "нет" };

/** Заклинание уровня ячейки: уровень персонажа на его урон не влияет. */
function bySlot(damage: typeof magicMissile | typeof noDamage, slotLevel: number): string {
  return effectiveDamage(damage, { spellLevel: 1, slotLevel, characterLevel: 7 });
}

/** Заговор: ячейки у него нет, растёт он уровнем персонажа. */
function byCharacter(damage: typeof rayOfFrost | typeof noDamage, characterLevel: number): string {
  return effectiveDamage(damage, { spellLevel: 0, slotLevel: 0, characterLevel });
}

describe("effectiveDamage: заклинание растёт ячейкой", () => {
  it.each([
    [1, "3d4+3"],
    [2, "4d4+4"],
    [3, "5d4+5"],
    [4, "6d4+6"],
  ])("ячейка %i уровня даёт %s", (slotLevel, expected) => {
    expect(bySlot(magicMissile, slotLevel)).toBe(expected);
  });

  it("возвращает базовую формулу для уровня без записи в таблице", () => {
    expect(bySlot(magicMissile, 9)).toBe("3d4+3");
    expect(bySlot(noDamage, 3)).toBe("—");
  });
});

describe("effectiveDamage: заговор растёт уровнем персонажа", () => {
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
    expect(byCharacter(rayOfFrost, characterLevel)).toBe(expected);
  });

  it("возвращает базовую формулу у заговора без масштабирования", () => {
    expect(byCharacter(noDamage, 20)).toBe("—");
  });

  it("для заговора ячейка не значит ничего", () => {
    expect(effectiveDamage(rayOfFrost, { spellLevel: 0, slotLevel: 4, characterLevel: 7 })).toBe(
      "2d8",
    );
  });

  it("для заклинания уровень персонажа не значит ничего", () => {
    expect(effectiveDamage(magicMissile, { spellLevel: 1, slotLevel: 3, characterLevel: 20 })).toBe(
      "5d4+5",
    );
  });
});

describe("benefitsFromHigherSlot", () => {
  it("обещает выгоду там, где урон масштабируется", () => {
    expect(benefitsFromHigherSlot({ damage: magicMissile })).toBe(true);
  });

  it("обещает выгоду там, где повышение описано словами без урона", () => {
    // «Невидимость» повышением берёт лишнюю цель, а не урон: обещание идёт от текста.
    expect(benefitsFromHigherSlot({ higherLevelsRu: "по одной цели за уровень выше второго" })).toBe(
      true,
    );
  });

  it("не обещает выгоды там, где повышать нечего", () => {
    expect(benefitsFromHigherSlot({})).toBe(false);
  });
});
