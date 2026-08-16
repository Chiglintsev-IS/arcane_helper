import { BLOOD_MAGIC_TRAITS, traitsOf } from "@/ui/shared/model/actionTraits";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { IN_FIGHT, testSpellRow, testSpellRows } from "@/ui/app/testing/stores";

import {
  compareTraits,
  orderForPlay,
  orderKey,
  positionInList,
  spellsForScreen,
} from "@/ui/shared/model/spellList";

/** Список «Игры» для Торна: одна функция на обе ситуации, различает их отметка боя. */
function playList(inFight: boolean): string[] {
  return spellsForScreen(testSpellRows(undefined, inFight ? IN_FIGHT : []), "play").map(
    (spell) => spell.id,
  );
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
      const spell = testSpellRow(id, undefined, IN_FIGHT);
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
    const reaction = { nameRu: "Дорогая реакция", castingTime: "reaction", level: 4, concentration: false, role: "other" } as const;
    const action = { nameRu: "Бесплатное действие", castingTime: "action", level: 0, concentration: false, role: "offense" } as const;

    expect(compareTraits(reaction, action)).toBeGreaterThan(0);
    expect(orderKey(action)).toEqual([0, 0]);
  });

  it("сортировка не меняет исходный список", () => {
    const rows = testSpellRows(undefined, IN_FIGHT);
    const before = rows.map((spell) => spell.id);
    orderForPlay(rows);
    expect(rows.map((spell) => spell.id)).toEqual(before);
  });
});

describe("«Магия крови» встаёт среди того, что ячейки не стоит (FR-207, FR-210)", () => {
  it("в бою — сразу за заговорами", () => {
    const shown = spellsForScreen(testSpellRows(undefined, IN_FIGHT), "play");
    const rows = shown.map((spell) => spell.id);
    rows.splice(positionInList(shown, BLOOD_MAGIC_TRAITS, "play"), 0, "магия-крови");

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
    const shown = spellsForScreen(testSpellRows(), "play");
    const at = positionInList(shown, BLOOD_MAGIC_TRAITS, "play");
    expect(shown[at - 1]?.id).toBe("unseen-servant");
    expect(shown[at]?.id).toBe("shield");
  });

  it("в «Книге» место ищется уровнем: там смотрят состав, а не цену момента", () => {
    const rows = testSpellRows();
    const at = positionInList(rows, BLOOD_MAGIC_TRAITS, "book");
    expect(rows[at]?.id).toBe("shield");
  });

  it("строка дороже всего списка встаёт в конец, а не теряется", () => {
    const priciest = { ...BLOOD_MAGIC_TRAITS, level: 9 };

    const rows = testSpellRows();
    expect(positionInList(rows, priciest, "book")).toBe(rows.length);
    const inFight = testSpellRows(undefined, IN_FIGHT);
    expect(positionInList(inFight, priciest, "play")).toBe(inFight.length);
  });
});

describe("состав по режимам (FR-203, FR-220, FR-230)", () => {
  it("книга не отбирает ничего и порядка не трогает", () => {
    expect(spellsForScreen(testSpellRows(), "book")).toEqual(testSpellRows());
    const inFight = testSpellRows(undefined, IN_FIGHT);
    expect(spellsForScreen(inFight, "book")).toEqual(inFight);
  });

  it("в «Журнале» и «Листе» списка нет", () => {
    for (const mode of ["journal", "sheet", "things", "rest"] as const) {
      expect(spellsForScreen(testSpellRows(), mode), mode).toEqual([]);
    }
  });

  it("ушедшее из «Игры» не пропадает: оно в книге", () => {
    const rows = testSpellRows(undefined, IN_FIGHT);
    const book = new Set(spellsForScreen(rows, "book").map((spell) => spell.id));
    for (const spell of spellsForScreen(rows, "play")) {
      expect(book.has(spell.id), `${spell.nameRu} не попал никуда`).toBe(true);
    }
  });
});

describe("состав строки: цена считается тем же правилом, что и порядок", () => {
  it("признаки заклинания собираются той же функцией, что и признаки действия", () => {
    expect(traitsOf(testSpellRow("detect-magic"))).toEqual({
      nameRu: "Обнаружение магии",
      castingTime: "action",
      level: 0,
      concentration: true,
      role: "other",
    });
    // В бою ритуального способа нет, и то же заклинание стоит свой уровень.
    expect(traitsOf(testSpellRow("detect-magic", undefined, IN_FIGHT)).level).toBe(1);
  });

  it("подготовка меняет состав, а не порядок", () => {
    const character = createThorne();
    const withRitual = {
      ...character,
      preparedSpellIds: [...character.preparedSpellIds, "detect-magic"],
    };

    expect(testSpellRow("detect-magic", withRitual, IN_FIGHT).castableNow).toBe(true);
  });
});
