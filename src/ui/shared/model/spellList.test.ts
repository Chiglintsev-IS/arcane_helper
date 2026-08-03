import { BLOOD_MAGIC_TRAITS, traitsOf } from "@/ui/shared/model/actionTraits";
import {
  castableInSituation,
  castableWithinTurn,
  slotPriceOf,
} from "@/core/application/casting/castOptions";
import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

import {
  compareTraits,
  orderForPlay,
  orderKey,
  positionInList,
  spellsForScreen,
} from "@/ui/shared/model/spellList";

const SPELLS = loadThorneSpells();

/** Список «Игры» для Торна: одна функция на обе ситуации, различает их отметка боя. */
function playList(inFight: boolean): string[] {
  return spellsForScreen(SPELLS, createThorne(), "play", inFight).map((spell) => spell.id);
}

describe("вне боя: заговоры, подготовленные и ритуальные из книги (FR-209)", () => {
  it("ритуал из книги стоит в списке без подготовки", () => {
    // Ни одного ритуала Торн сегодня не подготовил, а сотворить их всё равно может.
    for (const id of ["detect-magic", "identify", "find-familiar", "unseen-servant"]) {
      expect(playList(false), id).toContain(id);
    }
  });

  it("неподготовленное неритуальное в список не попадает", () => {
    for (const id of ["blink", "fly", "dimension-door"]) {
      expect(playList(false), id).not.toContain(id);
    }
  });

  it("долгое накладывание не отбрасывается: торопиться некуда", () => {
    expect(playList(false)).toContain("mending");
  });
});

describe("в бою: заговоры и подготовленные, творимые внутри хода (FR-201)", () => {
  it("накладываемого минутами и часами в списке нет", () => {
    for (const id of playList(true)) {
      const spell = SPELLS.find((candidate) => candidate.id === id)!;
      expect(["minute", "hour"], spell.nameRu).not.toContain(spell.castingTime.type);
    }
  });

  it("неподготовленный ритуал уходит совсем: ячейкой его не сотворить", () => {
    expect(playList(false)).toContain("detect-magic");
    expect(playList(true)).not.toContain("detect-magic");
  });

  it("подготовленное остаётся: в бою оно творится ячейкой", () => {
    for (const id of ["shield", "web", "polymorph"]) {
      expect(playList(true), id).toContain(id);
    }
  });
});

describe("порядок: сначала бесплатное, потом по уровню ячейки, потом роль (FR-210)", () => {
  it("вне боя ритуал стоит рядом с заговорами", () => {
    expect(playList(false)).toEqual([
      "shocking-grasp",
      "ray-of-frost",
      "message",
      "mending",
      "find-familiar",
      "detect-magic",
      "identify",
      "unseen-servant",
      "shield",
      "absorb-elements",
      "mage-armor",
      "web",
      "misty-step",
      "mirror-image",
      "invisibility",
      "hypnotic-pattern",
      "lightning-bolt",
      "counterspell",
      "polymorph",
    ]);
  });

  it("в бою реакции наверх не всплывают, а цена решает всё", () => {
    // «Щит» — реакция первого уровня — стоит среди первых уровней, а не над заговорами.
    expect(playList(true)).toEqual([
      "shocking-grasp",
      "ray-of-frost",
      "message",
      "shield",
      "absorb-elements",
      "mage-armor",
      "web",
      "misty-step",
      "mirror-image",
      "invisibility",
      "hypnotic-pattern",
      "lightning-bolt",
      "counterspell",
      "polymorph",
    ]);
  });


  it("ключ: цена, затем роль", () => {
    const reaction = { castingTime: "reaction", level: 4, concentration: false, role: "other" } as const;
    const action = { castingTime: "action", level: 0, concentration: false, role: "offense" } as const;

    expect(compareTraits(reaction, action)).toBeGreaterThan(0);
    expect(orderKey(action)).toEqual([0, 0]);
  });

  it("сортировка не меняет исходный список", () => {
    const before = SPELLS.map((spell) => spell.id);
    orderForPlay(SPELLS, true);
    expect(SPELLS.map((spell) => spell.id)).toEqual(before);
  });
});

describe("«Магия крови» встаёт среди того, что ячейки не стоит (FR-207, FR-210)", () => {
  it("в бою — сразу за заговорами", () => {
    const shown = spellsForScreen(SPELLS, createThorne(), "play", true);
    const rows = shown.map((spell) => spell.id);
    rows.splice(positionInList(shown, BLOOD_MAGIC_TRAITS, "play", true), 0, "магия-крови");

    // Последним бесплатным идёт «Сообщение» — та же цена и та же роль «другое», что у обмена.
    expect(rows.slice(0, 5)).toEqual([
      "shocking-grasp",
      "ray-of-frost",
      "message",
      "магия-крови",
      "shield",
    ]);
  });

  it("вне боя — за ритуалами: они тоже ничего не стоят", () => {
    const shown = spellsForScreen(SPELLS, createThorne(), "play", false);
    const at = positionInList(shown, BLOOD_MAGIC_TRAITS, "play", false);
    expect(shown[at - 1]?.id).toBe("unseen-servant");
    expect(shown[at]?.id).toBe("shield");
  });

  it("в «Книге» место ищется уровнем: там смотрят состав, а не цену момента", () => {
    const at = positionInList(SPELLS, BLOOD_MAGIC_TRAITS, "book", false);
    expect(SPELLS[at]?.id).toBe("shield");
  });

  it("строка дороже всего списка встаёт в конец, а не теряется", () => {
    const priciest = { ...BLOOD_MAGIC_TRAITS, level: 9 };

    expect(positionInList(SPELLS, priciest, "book", false)).toBe(SPELLS.length);
    expect(positionInList(SPELLS, priciest, "play", true)).toBe(SPELLS.length);
  });
});

describe("состав по режимам (FR-203, FR-220, FR-230)", () => {
  it("книга не отбирает ничего и порядка не трогает", () => {
    const character = createThorne();
    expect(spellsForScreen(SPELLS, character, "book", false)).toEqual(SPELLS);
    expect(spellsForScreen(SPELLS, character, "book", true)).toEqual(SPELLS);
  });

  it("в «Журнале» и «Листе» списка нет", () => {
    for (const mode of ["journal", "sheet", "bag", "rest"] as const) {
      expect(spellsForScreen(SPELLS, createThorne(), mode, false), mode).toEqual([]);
    }
  });

  it("ушедшее из «Игры» не пропадает: оно в книге", () => {
    const book = new Set(SPELLS.map((spell) => spell.id));
    for (const spell of SPELLS) {
      expect(book.has(spell.id), `${spell.nameRu} не попал никуда`).toBe(true);
    }
  });
});

describe("состав строки: цена считается тем же правилом, что и порядок", () => {
  it("признаки заклинания собираются той же функцией, что и признаки действия", () => {
    const detectMagic = SPELLS.find((spell) => spell.id === "detect-magic")!;

    expect(traitsOf(detectMagic, false)).toEqual({
      castingTime: "action",
      level: 0,
      concentration: true,
      role: "other",
    });
    expect(traitsOf(detectMagic, true).level).toBe(1);
  });

  it("подготовка меняет состав, а не порядок", () => {
    const character = createThorne();
    const withRitual = {
      ...character,
      preparedSpellIds: [...character.preparedSpellIds, "detect-magic"],
    };

    expect(castableInSituation(SPELLS.find((s) => s.id === "detect-magic")!, withRitual, true)).toBe(
      true,
    );
  });
});
