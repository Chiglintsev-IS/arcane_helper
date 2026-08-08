import { describe, expect, it } from "vitest";

import { CharacterBase } from "@/core/domain/character/base";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

describe("персонаж: база без вещей", () => {
  it("отдаёт уровень и ничего производного: производное складывает лист", () => {
    expect(CharacterBase.of(createThorne()).level).toBe(7);
  });
});
