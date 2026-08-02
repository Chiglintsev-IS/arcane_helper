import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { hitDiceLabel } from "@/ui/widgets/resource-header/lib/hitDiceLabel";

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

describe("кости хитов Торна словами", () => {
  it("полный пул читается как в листе", () => {
    expect(hitDiceLabel(createThorne().hitDice)).toBe("7d6");
  });
});
