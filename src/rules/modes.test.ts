import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/data/content/thorne";

import { belongsToMode, castableWithinTurn, spellsForMode, SCREEN_MODES } from "./modes";

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
