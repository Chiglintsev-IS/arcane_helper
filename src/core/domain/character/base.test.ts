import { describe, expect, it } from "vitest";

import { CharacterBase } from "@/core/domain/character/base";
import { createWizard } from "@/core/infrastructure/catalog/thorne/fixtures";

describe("персонаж: база без вещей", () => {
  it("отдаёт уровень и ничего производного: производное складывает лист", () => {
    expect(CharacterBase.of(createWizard()).level).toBe(7);
  });
});
