import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { Spell } from "@/core/domain/catalog/spell";

import { combatRoleOf } from "@/core/domain/catalog/combatRole";

const SPELLS = loadThorneSpells();

function byId(id: string): Spell {
  const spell = SPELLS.find((candidate) => candidate.id === id);
  expect(spell, id).toBeDefined();
  return spell!;
}

describe("combatRoleOf (FR-213)", () => {
  it.each([
    ["ray-of-frost", "offense"],
    ["absorb-elements", "defense"],
    ["message", "other"],
  ])("«%s» — %s", (id, expected) => {
    expect(combatRoleOf(byId(id))).toBe(expected);
  });

  it("роль не выводится из урона: «Поглощение стихий» несёт урон и остаётся защитным", () => {
    const spell = byId("absorb-elements");
    expect(spell.damage).toBeDefined();
    expect(combatRoleOf(spell)).toBe("defense");
  });

  it("молчание данных читается как «другое», а не как «боевое»", () => {
    // Так выглядит карточка из чужой выгрузки: схема её пропускает, роли в ней нет.
    const { combatRole: _absent, ...imported } = byId("ray-of-frost");
    expect(combatRoleOf(imported)).toBe("other");
  });
});
