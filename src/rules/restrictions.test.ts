import { describe, expect, it } from "vitest";

import { BANNED_SPELLS, loadThorneSpells, HARMFUL_DAMAGE_TYPES } from "@/data/content/thorne";

import { findBan, matchesQuery } from "./restrictions";

const SPELLS = loadThorneSpells();

function byId(id: string) {
  const spell = SPELLS.find((candidate) => candidate.id === id);
  expect(spell, id).toBeDefined();
  return spell!;
}

describe("findBan (FR-162)", () => {
  it("находит запрет по части русского названия", () => {
    expect(findBan("понимание", BANNED_SPELLS)?.nameEn).toBe("Comprehend Languages");
  });

  it("находит по английскому названию и не смотрит на регистр", () => {
    expect(findBan("COMPREHEND", BANNED_SPELLS)?.nameRu).toBe("Понимание языков");
  });

  it("«ё» и «е» за столом набирают как придётся", () => {
    const banned = [
      { nameRu: "Огненный ёж", nameEn: "Fire Hedgehog", reason: "dungeon_master" as const, explanationRu: "нет" },
    ];
    expect(findBan("ежик", banned)).toBeNull();
    expect(findBan("огненный еж", banned)?.nameEn).toBe("Fire Hedgehog");
  });

  it("на пустом запросе молчит: иначе причина всплывала бы на пустом поле", () => {
    expect(findBan("", BANNED_SPELLS)).toBeNull();
    expect(findBan("   ", BANNED_SPELLS)).toBeNull();
  });

  it("на разрешённое заклинание запрета не находит", () => {
    expect(findBan("Опознание", BANNED_SPELLS)).toBeNull();
  });
});

describe("matchesQuery (FR-162)", () => {
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
