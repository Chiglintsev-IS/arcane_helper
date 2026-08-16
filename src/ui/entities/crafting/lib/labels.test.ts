import { describe, expect, it } from "vitest";

import { DIRECTION_LABELS, RARITY_LABELS, labelled } from "@/ui/entities/crafting/lib/labels";

describe("слово ремесла и подпись к нему", () => {
  it("известный код читается своей подписью", () => {
    expect(labelled(RARITY_LABELS, "veryRare")).toBe("очень редкое");
    expect(labelled(DIRECTION_LABELS, "poisons")).toBe("синтез ядов");
  });

  it("направление, которого словарь ещё не знает, доезжает до экрана своим словом", () => {
    // Договор ручается за непустую строку, а не за перечень направлений: новая редакция
    // справочника принесёт четвёртое, и промолчать о нём хуже, чем назвать его как есть.
    expect(labelled(DIRECTION_LABELS, "alchemy")).toBe("alchemy");
  });
});
