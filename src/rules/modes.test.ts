import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/data/content/thorne";

import { createThorne } from "@/data/content/thorne/character";

import {
  belongsToMode,
  castableWithinTurn,
  orderForCombat,
  preparedForCombat,
  spellsForMode,
  spellsForScreen,
  SCREEN_MODES,
} from "./modes";

const SPELLS = loadThorneSpells();

function idsFor(mode: (typeof SCREEN_MODES)[number]): string[] {
  return spellsForMode(SPELLS, mode)
    .map((spell) => spell.id)
    .sort();
}

describe("castableWithinTurn", () => {
  it.each([
    ["shocking-grasp", true], // действие
    ["shield", true], // реакция
    ["mending", false], // 1 минута
    ["find-familiar", false], // 1 час
  ])("«%s» — %s", (id, expected) => {
    const spell = SPELLS.find((candidate) => candidate.id === id);
    expect(spell, id).toBeDefined();
    expect(castableWithinTurn(spell!)).toBe(expected);
  });
});

describe("отбор по режиму (FR-201, FR-202, FR-203)", () => {
  it("в бою нет ничего с накладыванием в минутах и часах", () => {
    for (const spell of spellsForMode(SPELLS, "combat")) {
      expect(["minute", "hour"], spell.nameRu).not.toContain(spell.castingTime.type);
    }
  });

  it("бой — девять карточек из двенадцати", () => {
    // «Починка», «Поиск фамильяра» и «Опознание» творятся минутами и часами: в бою их нет.
    expect(idsFor("combat")).toEqual([
      "absorb-elements",
      "detect-magic",
      "disguise-self",
      "mage-armor",
      "message",
      "ray-of-frost",
      "shield",
      "shocking-grasp",
      "unseen-servant",
    ]);
  });

  it("привал — долгое накладывание и ритуалы", () => {
    expect(idsFor("camp")).toEqual([
      "detect-magic",
      "find-familiar",
      "identify",
      "mending",
      "unseen-servant",
    ]);
  });

  it("ритуал действием попадает в оба режима: способы разные, заклинание одно", () => {
    // «Обнаружение магии» в бою идёт за ячейку, на привале — ритуалом за лишние 10 минут (FR-208).
    expect(belongsToMode(SPELLS.find((s) => s.id === "detect-magic")!, "combat")).toBe(true);
    expect(belongsToMode(SPELLS.find((s) => s.id === "detect-magic")!, "camp")).toBe(true);
  });

  it("книга не отбирает ничего", () => {
    expect(spellsForMode(SPELLS, "book")).toHaveLength(SPELLS.length);
  });

  it("каждое заклинание попадает хотя бы в один режим кроме книги", () => {
    for (const spell of SPELLS) {
      const found = belongsToMode(spell, "combat") || belongsToMode(spell, "camp");
      expect(found, `${spell.nameRu} не попал никуда`).toBe(true);
    }
  });
});

describe("боевой список: состав и порядок (FR-209, FR-210)", () => {
  it("содержит заговоры и подготовленные, но не остальное", () => {
    const shown = spellsForScreen(SPELLS, createThorne()).map((spell) => spell.id);

    // Заговоры входят вне лимита подготовки; «Обнаружение магии» подготовлено не было.
    expect(shown).toContain("ray-of-frost");
    expect(shown).toContain("mage-armor");
    expect(shown).not.toContain("detect-magic");
    expect(shown).not.toContain("unseen-servant");
  });

  it("реакции идут первыми, дальше по возрастанию цены", () => {
    const shown = spellsForScreen(SPELLS, createThorne()).map((spell) => spell.id);

    expect(shown.slice(0, 2).sort()).toEqual(["absorb-elements", "shield"]);
    // За реакциями — заговоры, и только потом заклинания первого уровня.
    const levels = spellsForScreen(SPELLS, createThorne())
      .filter((spell) => spell.castingTime.type !== "reaction")
      .map((spell) => spell.level);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  it("вне боя ни состав, ни порядок не трогаются", () => {
    const character = { ...createThorne(), screenMode: "book" as const };
    expect(spellsForScreen(SPELLS, character)).toEqual(SPELLS);
  });

  it("подготовка меняет состав, а не порядок", () => {
    const character = createThorne();
    const withRitual = { ...character, preparedSpellIds: [...character.preparedSpellIds, "detect-magic"] };
    expect(preparedForCombat(SPELLS, withRitual).map((s) => s.id)).toContain("detect-magic");
  });

  it("сортировка не меняет исходный список", () => {
    const before = SPELLS.map((spell) => spell.id);
    orderForCombat(SPELLS);
    expect(SPELLS.map((spell) => spell.id)).toEqual(before);
  });
});
