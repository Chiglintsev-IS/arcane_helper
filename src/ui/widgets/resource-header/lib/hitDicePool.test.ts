import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { hitDicePool } from "@/ui/widgets/resource-header/lib/hitDicePool";

describe("пул костей хитов плиткой (FR-134)", () => {
  it("имя несёт размер кости, остаток — оба числа", () => {
    expect(hitDicePool({ total: 7, size: 6, remaining: 7 })).toEqual({
      nameRu: "Кости d6",
      remaining: "7/7",
      available: true,
    });
  });

  it("потраченное видно остатком, а не пересчётом", () => {
    expect(hitDicePool({ total: 7, size: 6, remaining: 5 }).remaining).toBe("5/7");
  });

  it("пустой пул платить не даёт", () => {
    expect(hitDicePool({ total: 7, size: 6, remaining: 0 }).available).toBe(false);
  });

  it("состояние без костей молчать не должно: их могло не быть в чужой выгрузке", () => {
    expect(hitDicePool(undefined)).toEqual({
      nameRu: "Кости",
      remaining: "нет",
      available: false,
    });
  });
});

describe("кости хитов Торна плиткой", () => {
  it("полный пул читается как в листе", () => {
    expect(hitDicePool(createThorne().hitDice)).toEqual({
      nameRu: "Кости d6",
      remaining: "7/7",
      available: true,
    });
  });
});
