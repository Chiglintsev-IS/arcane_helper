import { describe, expect, it } from "vitest";

import { traitsOf } from "@/ui/shared/model/actionTraits";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";

const SPELLS = loadThorneSpells();

describe("traitsOf", () => {
  it("признаки заклинания собираются той же функцией, что и признаки действия", () => {
    const shield = SPELLS.find((spell) => spell.id === "shield");
    expect(traitsOf(shield!, true)).toEqual({
      castingTime: "reaction",
      level: 1,
      concentration: false,
      role: "defense",
    });
  });
});
