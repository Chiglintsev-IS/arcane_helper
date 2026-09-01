import { describe, expect, it } from "vitest";

import { Familiar } from "./familiar";
import { FRUBIT } from "./frubit";

const WILD_PROFICIENCY = 2;

const THORNE_PROFICIENCY = 3;

function valueOf(proficiency: number, nameRu: string): number {
  const check = Familiar.bondedTo(FRUBIT, proficiency).checks.find(
    (candidate) => candidate.nameRu === nameRu,
  );
  return check!.value;
}

describe("фамильяр берёт бонус мастерства контрактора", () => {
  it("несвязанный фрубит выходит на числа, напечатанные в справочнике", () => {
    expect(valueOf(WILD_PROFICIENCY, "Внимательность")).toBe(5);
    expect(valueOf(WILD_PROFICIENCY, "Травничество")).toBe(4);
    expect(Familiar.bondedTo(FRUBIT, WILD_PROFICIENCY).passivePerception).toBe(15);
  });

  it("бонус мастерства волшебника седьмого уровня поднимает каждое из чисел", () => {
    expect(valueOf(THORNE_PROFICIENCY, "Внимательность")).toBe(6);
    expect(valueOf(THORNE_PROFICIENCY, "Травничество")).toBe(5);
    expect(Familiar.bondedTo(FRUBIT, THORNE_PROFICIENCY).passivePerception).toBe(16);
  });

  it("травничество идёт первым и несёт условие преимущества", () => {
    const [first] = Familiar.bondedTo(FRUBIT, THORNE_PROFICIENCY).checks;

    expect(first).toEqual({
      nameRu: "Травничество",
      ability: "intelligence",
      value: 5,
      advantageRu: FRUBIT.skills.herbalism.advantageRu,
    });
  });

  it("характеристики отдаются с модификаторами статблока", () => {
    expect(Familiar.bondedTo(FRUBIT, THORNE_PROFICIENCY).scores).toEqual([
      { ability: "strength", score: 4, modifier: -3 },
      { ability: "dexterity", score: 16, modifier: 3 },
      { ability: "constitution", score: 12, modifier: 1 },
      { ability: "intelligence", score: 14, modifier: 2 },
      { ability: "wisdom", score: 16, modifier: 3 },
      { ability: "charisma", score: 12, modifier: 1 },
    ]);
  });
});
