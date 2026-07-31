import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/data/content/thorne";

import { createThorne } from "@/data/content/thorne/character";

import { BLOOD_MAGIC_TRAITS } from "./bloodMagic";
import { traitsOf } from "./filters";
import {
  belongsToMode,
  castableWithinTurn,
  combatOrderKey,
  compareCombatTraits,
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

  it("бой — вся книга, кроме накладываемого минутами и часами", () => {
    // «Починка» (1 минута), «Опознание» (1 минута) и «Поиск фамильяра» (1 час) в ход не влезают.
    const combat = new Set(idsFor("combat"));
    expect(combat.size).toBe(SPELLS.length - 3);
    for (const id of ["mending", "identify", "find-familiar"]) {
      expect(combat.has(id), id).toBe(false);
    }
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

    // Заговоры входят вне лимита подготовки; ритуалы в стартовый набор не входят (FR-103).
    expect(shown).toContain("ray-of-frost");
    expect(shown).toContain("mage-armor");
    expect(shown).not.toContain("detect-magic");
    expect(shown).not.toContain("unseen-servant");
    // «Мерцание» есть в книге, но сегодня не подготовлено — в бою его нет.
    expect(shown).not.toContain("blink");
  });

  it("реакции, затем цена, затем роль (FR-210)", () => {
    // Реакции наверху; дальше бесплатное — заговоры, сначала боевые; потом ячейки по возрастанию,
    // и внутри уровня боевое раньше защитного.
    expect(spellsForScreen(SPELLS, createThorne()).map((spell) => spell.id)).toEqual([
      "shield",
      "absorb-elements",
      "counterspell",
      "shocking-grasp",
      "ray-of-frost",
      "message",
      "mage-armor",
      "web",
      "misty-step",
      "mirror-image",
      "invisibility",
      "hypnotic-pattern",
      "lightning-bolt",
      "polymorph",
    ]);
  });

  it("«Магия крови» встаёт сразу за заговорами: ячейку она не тратит (FR-207, FR-210)", () => {
    // Так её место и находит экран: первая строка, которая по ключу строго дальше.
    const combat = spellsForScreen(SPELLS, createThorne());
    const at = combat.findIndex(
      (spell) => compareCombatTraits(traitsOf(spell), BLOOD_MAGIC_TRAITS) > 0,
    );
    const rows = combat.map((spell) => spell.id);
    rows.splice(at, 0, "магия-крови");

    // Последним заговором идёт «Сообщение» — та же цена и та же роль «другое», что у обмена.
    expect(rows.slice(0, 8)).toEqual([
      "shield",
      "absorb-elements",
      "counterspell",
      "shocking-grasp",
      "ray-of-frost",
      "message",
      "магия-крови",
      "mage-armor",
    ]);
  });

  it("порядок ключа: сначала реакция, потом цена, потом роль", () => {
    const key = (traits: Parameters<typeof combatOrderKey>[0]) => combatOrderKey(traits);
    const reaction = { castingTime: "reaction", level: 4, concentration: false, role: "other" } as const;
    const action = { castingTime: "action", level: 0, concentration: false, role: "offense" } as const;

    // Реакция четвёртого уровня всё равно выше заговора: триггер приходит в чужой ход.
    expect(compareCombatTraits(reaction, action)).toBeLessThan(0);
    expect(key(action)).toEqual([1, 0, 0]);
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
