import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { spellSchema, type Spell } from "@/core/domain/catalog/spell";

import { combatRolesOf, combatRolesSchema, foldRetiredSingleRole } from "@/core/domain/catalog/combatRole";

const SPELLS = loadThorneSpells();

function byId(id: string): Spell {
  const spell = SPELLS.find((candidate) => candidate.id === id);
  expect(spell, id).toBeDefined();
  return spell!;
}

describe("combatRolesOf", () => {
  it.each([
    ["lightning-bolt", ["damage"]],
    ["web", ["hindrance"]],
    ["haste", ["support", "movement"]],
    ["thunder-step", ["movement", "damage"]],
    ["absorb-elements", ["support"]],
    ["message", ["other"]],
  ])("«%s» — %j", (id, expected) => {
    expect(combatRolesOf(byId(id))).toEqual(expected);
  });

  it("роль не выводится из урона: «Поглощение стихий» несёт урон, но творится ради прикрытия", () => {
    const spell = byId("absorb-elements");
    expect(spell.damage).toBeDefined();
    expect(combatRolesOf(spell)).toEqual(["support"]);
  });

  it("контроль и поддержка урона не несут, но «прочим» не считаются", () => {
    expect(byId("slow").damage).toBeUndefined();
    expect(byId("haste").damage).toBeUndefined();
    expect(combatRolesOf(byId("slow"))).toEqual(["hindrance"]);
    expect(combatRolesOf(byId("haste"))).toContain("support");
  });

  it("молчание данных читается как «прочее», а не как «урон»", () => {
    const { combatRoles: _absent, ...imported } = byId("lightning-bolt");
    expect(combatRolesOf(imported)).toEqual(["other"]);
  });
});

describe("combatRolesSchema", () => {
  it("принимает непустой перечень без повторов", () => {
    expect(combatRolesSchema.parse(["damage", "hindrance"])).toEqual(["damage", "hindrance"]);
  });

  it("пустой перечень отвергает с причиной", () => {
    const parsed = combatRolesSchema.safeParse([]);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toContain("не бывает пустым");
  });

  it("повтор роли отвергает", () => {
    expect(combatRolesSchema.safeParse(["damage", "damage"]).success).toBe(false);
  });

  it("«прочее» рядом с боевой ролью отвергает", () => {
    const parsed = combatRolesSchema.safeParse(["other", "damage"]);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toContain("«Прочее» стоит одно");
  });

  it("роль «боевое» прежней выгрузки читается как урон", () => {
    expect(combatRolesSchema.parse(["offense"])).toEqual(["damage"]);
  });

  it("защита и усиление прежней выгрузки читаются поддержкой", () => {
    expect(combatRolesSchema.parse(["defense"])).toEqual(["support"]);
    expect(combatRolesSchema.parse(["buff", "movement"])).toEqual(["support", "movement"]);
  });

  it("незнакомую роль отвергает", () => {
    expect(combatRolesSchema.safeParse(["attack"]).success).toBe(false);
  });
});

describe("карточка прежней выгрузки с одиночной ролью", () => {
  it("одиночная роль сворачивается в перечень из одной", () => {
    expect(foldRetiredSingleRole({ id: "x", combatRole: "hindrance" })).toEqual({ id: "x", combatRoles: ["hindrance"] });
  });

  it("перечень, если он уже есть, одиночной ролью не подменяется", () => {
    const card = { combatRole: "hindrance", combatRoles: ["damage"] };
    expect(foldRetiredSingleRole(card)).toBe(card);
  });

  it("схема карточки читает «боевое» прежней выгрузки как урон", () => {
    const { combatRoles: _current, ...rest } = byId("lightning-bolt");
    const parsed = spellSchema.safeParse({ ...rest, combatRole: "offense" });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.combatRoles).toEqual(["damage"]);
  });
});
