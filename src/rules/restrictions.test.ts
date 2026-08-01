import { describe, expect, it } from "vitest";

import { BANNED_SPELLS, loadThorneSpells, HARMFUL_DAMAGE_TYPES } from "@/data/content/thorne";

import { matchesQuery } from "./restrictions";

const SPELLS = loadThorneSpells();

function byId(id: string) {
  const spell = SPELLS.find((candidate) => candidate.id === id);
  expect(spell, id).toBeDefined();
  return spell!;
}

// matchesQuery служит поиску по книге и строке «Магия крови» (FR-207), а не запретам кампании:
// findBan, отвечавший на поиск запрещённого (FR-162), удалён вместе с требованием — см. OQ-34.
describe("matchesQuery (FR-207)", () => {
  it("ищет по обоим названиям", () => {
    expect(matchesQuery(byId("misty-step"), "туман")).toBe(true);
    expect(matchesQuery(byId("misty-step"), "misty")).toBe(true);
    expect(matchesQuery(byId("misty-step"), "паутина")).toBe(false);
  });

  it("пустой запрос ничего не сужает", () => {
    for (const spell of SPELLS) {
      expect(matchesQuery(spell, ""), spell.nameRu).toBe(true);
    }
  });
});

describe("реестр запретов (FR-160, FR-161)", () => {
  it("запрещённого нет в книге ни под русским, ни под английским названием", () => {
    for (const ban of BANNED_SPELLS) {
      expect(SPELLS.some((spell) => spell.nameEn === ban.nameEn), ban.nameRu).toBe(false);
      expect(SPELLS.some((spell) => spell.nameRu === ban.nameRu), ban.nameRu).toBe(false);
    }
  });

  it("огонь запрещён данными, а не перечислением", () => {
    // Перечислить всю огненную школу руками нельзя, а пропущенное заклинание было бы ошибкой в
    // пользу опасного для тролля выбора (F-14).
    expect(HARMFUL_DAMAGE_TYPES).toContain("огонь");
    for (const spell of SPELLS) {
      for (const harmful of HARMFUL_DAMAGE_TYPES) {
        expect(spell.damage?.type.includes(harmful) ?? false, spell.nameRu).toBe(false);
      }
    }
  });

  it("у каждого запрета есть причина словами", () => {
    for (const ban of BANNED_SPELLS) {
      expect(ban.explanationRu.length, ban.nameRu).toBeGreaterThan(20);
    }
  });
});
