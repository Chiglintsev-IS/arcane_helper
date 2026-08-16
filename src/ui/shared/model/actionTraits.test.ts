import { describe, expect, it } from "vitest";

import { traitsOf } from "@/ui/shared/model/actionTraits";
import { IN_FIGHT, testSpellRow } from "@/ui/app/testing/stores";

describe("traitsOf", () => {
  it("признаки заклинания собираются той же функцией, что и признаки действия", () => {
    expect(traitsOf(testSpellRow("shield", undefined, IN_FIGHT))).toEqual({
      nameRu: "Щит",
      castingTime: "reaction",
      level: 1,
      concentration: false,
      role: "defense",
    });
  });
});
