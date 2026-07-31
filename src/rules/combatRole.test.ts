import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/data/content/thorne";
import type { Spell } from "@/data/schemas/spell";

import { combatRoleOf, rolesPresent } from "./combatRole";

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
    // Так выглядит карточка из чужой выгрузки: схема её пропускает, роли в ней нет (NFR-003).
    const { combatRole: _absent, ...imported } = byId("ray-of-frost");
    expect(combatRoleOf(imported)).toBe("other");
  });
});

describe("rolesPresent", () => {
  it("перечисляет роли, встречающиеся в списке", () => {
    expect([...rolesPresent(SPELLS)].sort()).toEqual(["defense", "offense", "other"]);
  });

  it("на списке из одних защитных возвращает одну роль: фильтру «Боевое» нечего искать", () => {
    const defensive = SPELLS.filter((spell) => combatRoleOf(spell) === "defense");
    expect([...rolesPresent(defensive)]).toEqual(["defense"]);
  });

  it("на пустом списке ролей нет", () => {
    expect(rolesPresent([]).size).toBe(0);
  });
});
