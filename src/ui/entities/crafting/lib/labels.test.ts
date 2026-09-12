import { describe, expect, it } from "vitest";

import { TIER_LABELS } from "@/ui/entities/crafting/lib/labels";
import { labelled } from "@/ui/shared/lib/alchemyLabels";

describe("слово ремесла и подпись к нему", () => {
  it("известный код читается своей подписью", () => {
    expect(labelled(TIER_LABELS, "concentrated")).toBe("концентрированная");
  });

  it("ступень, которой словарь ещё не знает, доезжает до экрана своим словом", () => {
    expect(labelled(TIER_LABELS, "перегретая")).toBe("перегретая");
  });
});
