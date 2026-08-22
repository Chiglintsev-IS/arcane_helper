/**
 * Отбор списка: какие категории делят список и что остаётся после переключателей.
 *
 * Проверяется на настоящей книге Торна и на её боевом составе: перечня категорий по режимам больше
 * нет, и единственный способ убедиться, что набор верен в обеих ситуациях, — посчитать его от
 * обоих списков.
 */

import { describe, expect, it } from "vitest";
import { withSpellPoints, withoutSlots } from "@/core/infrastructure/catalog/thorne/fixtures";

import {
  NO_FILTERS,
  dividingCategories,
  filterSpells,
  matchesActionRow,
  matchesTraits,
  toggleValue,
  type SpellFilters,
} from "@/ui/features/filter-spells/model/filters";
import type { Command } from "@/contract/commands";
import type { SpellRowView } from "@/contract/views";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { BLOOD_MAGIC_TRAITS } from "@/ui/shared/model/actionTraits";
import { spellsForScreen } from "@/ui/shared/model/spellList";
import { IN_FIGHT, testSpellRows } from "@/ui/app/testing/stores";

/**
 * Книга Торна строками: обстановка набирается командами, а не словарём признаков — израсходованное
 * действие есть следствие сыгранного, и подделать его подстановкой нельзя.
 */
function book(
  overrides: { character?: CharacterState; commands?: readonly Command[] } = {},
): SpellRowView[] {
  // Бой уже начат: этот файл проверяет фильтры, а не сам факт начала боя.
  return testSpellRows(overrides.character ?? createThorne(), overrides.commands ?? IN_FIGHT);
}

/** Бой не начат: только тогда у ритуального заклинания есть ритуальный способ. */
function outOfFight(character?: CharacterState): SpellRowView[] {
  return testSpellRows(character ?? createThorne(), []);
}

function categoriesOf(inFight: boolean) {
  const rows = testSpellRows(createThorne(), inFight ? IN_FIGHT : []);
  return dividingCategories(spellsForScreen(rows, "play"));
}

function ids(spells: readonly { id: string }[]): string[] {
  return spells.map((spell) => spell.id);
}

function filters(overrides: Partial<SpellFilters> = {}): SpellFilters {
  return { ...NO_FILTERS, ...overrides };
}

/** Свободных ячеек нет: тратит их правило ресурсов, а не фикстура. */
function spentThorne(): CharacterState {
  return withoutSlots(createThorne());
}

describe("dividingCategories", () => {
  it("категория, которой отвечает весь список, переключателя не получает", () => {
    const allConcentrating = outOfFight().filter((spell) => spell.concentration);
    expect(dividingCategories(allConcentrating).concentration).toBe(false);
  });

  it("категория, которой не отвечает никто, переключателя не получает", () => {
    const noRituals = outOfFight().filter((spell) => !spell.ritual);
    expect(dividingCategories(noRituals).ritual).toBe(false);
  });

  it("пустой список не предлагает ничего", () => {
    const empty = dividingCategories([]);

    expect(empty.prices).toEqual([]);
    expect(empty.castingTimes.size).toBe(0);
    expect(empty.roles.size).toBe(0);
    expect(empty.concentration).toBe(false);
    expect(empty.ritual).toBe(false);
  });

  it("«Ритуал» спрашивает про способ, а не про признак: в бою его нет", () => {
    expect(categoriesOf(false).ritual).toBe(true);
    expect(categoriesOf(true).ritual).toBe(false);
  });

  it("цена считается тем же ключом, что и порядок: вне боя ритуал стоит ноль", () => {
    // Заговоры и ритуалы стоят ноль, дальше идут уровни ячейки — те, что в списке есть.
    expect(categoriesOf(false).prices).toEqual([0, 1, 2, 3, 4]);
    expect(categoriesOf(true).prices).toEqual([0, 1, 2, 3, 4]);
  });

  it("время накладывания следует составу: долгого в бою нет", () => {
    // Вне боя «Починка» и «Опознание» делят список минутами; в бою их там нет вовсе.
    expect(categoriesOf(false).castingTimes.has("minute")).toBe(true);
    expect(categoriesOf(true).castingTimes.has("minute")).toBe(false);
  });
});

describe("filterSpells: список без фильтров", () => {
  it("ничего не скрывает: отбор по ситуации — дело режима, а не фильтров", () => {
    // Неподготовленные ритуалы раньше пропадали из списка и доставались фильтром «Ритуал». Правило
    // писалось для боя, где их и так нет, а на привале прятало сам смысл режима.
    expect(ids(filterSpells(book(), NO_FILTERS))).toEqual(ids(book()));
  });

  it("показывает ритуалы по фильтру «ритуал»", () => {
    // «Ритуал» спрашивает про способ: он есть, только пока бой не идёт.
    expect(ids(filterSpells(outOfFight(), filters({ ritual: true })))).toEqual([
      "find-familiar",
      "detect-magic",
      "identify",
      "unseen-servant",
    ]);
  });
});

describe("filterSpells: значения одной категории соединяются «или» (FR-003)", () => {
  it("время накладывания: действие", () => {
    const shown = ids(filterSpells(book(), filters({ castingTimes: ["action"] })));

    expect(shown).toContain("ray-of-frost");
    expect(shown).toContain("mage-armor");
    // Реакции, бонусные действия и долгое накладывание отсеиваются.
    expect(shown).not.toContain("shield");
    expect(shown).not.toContain("misty-step");
    expect(shown).not.toContain("mending");
  });

  it("время накладывания: действие или реакция", () => {
    const shown = ids(
      filterSpells(book(), filters({ castingTimes: ["action", "reaction"] })),
    );
    expect(shown).toContain("shield");
    expect(shown).toContain("absorb-elements");
    expect(shown).toContain("ray-of-frost");
    expect(shown).not.toContain("mending");
  });

  it("цена: без ячейки и первый уровень вместе", () => {
    const onlyCantrips = ids(filterSpells(book(), filters({ prices: [0] })));
    const both = ids(filterSpells(book(), filters({ prices: [0, 1] })));

    expect(onlyCantrips).toEqual(["shocking-grasp", "ray-of-frost", "message", "mending"]);
    // Четыре заговора и девять заклинаний первого уровня.
    expect(both).toHaveLength(13);
  });
});

describe("filterSpells: категории соединяются «и» (FR-003)", () => {
  it("действие плюс заговор оставляют только заговоры действием", () => {
    expect(
      ids(filterSpells(book(), filters({ castingTimes: ["action"], prices: [0] }))),
    ).toEqual(["shocking-grasp", "ray-of-frost", "message"]);
  });

  it("несовместимые категории дают пустой список, а не ошибку", () => {
    expect(
      filterSpells(book(), filters({ castingTimes: ["reaction"], prices: [0] })),
    ).toEqual([]);
  });
});

describe("filterSpells: концентрация и подготовка", () => {
  it("фильтр концентрации вместе с ритуалами находит «Обнаружение магии»", () => {
    expect(
      ids(filterSpells(outOfFight(), filters({ concentration: true, ritual: true }))),
    ).toEqual(["detect-magic"]);
  });

  it("фильтр «подготовлено» скрывает снятое с подготовки, но не заговоры (AC-05)", () => {
    const character = {
      ...createThorne(),
      preparedSpellIds: createThorne().preparedSpellIds.filter((id) => id !== "shield"),
    };

    const shown = ids(filterSpells(book({ character }), filters({ prepared: true })));
    expect(shown).not.toContain("shield");
    expect(shown).toContain("mage-armor");
    expect(shown).toContain("ray-of-frost");
  });
});

describe("filterSpells: «доступно сейчас» (FR-002)", () => {
  it("без свободных ячеек остаётся всё, за что платит кровь", () => {
    const shown = ids(
      filterSpells(book({ character: spentThorne() }), filters({ availableNow: true })),
    );
    // «Починки» здесь нет, хотя она заговор: минута не укладывается в ход, а режим — «Бой».
    // Прочее осталось: ячеек нет, но кровь заменяет их в любой момент и хода не занимает.
    expect(shown).toContain("ray-of-frost");
    expect(shown).toContain("lightning-bolt");
    expect(shown).not.toContain("mending");
  });

  it("израсходованное действие скрывает заклинания действием, но не реакции", () => {
    // Действие тратится сотворением, а не подстановкой признака: «Луч холода» — заговор действием.
    const spent = book({
      commands: [...IN_FIGHT, { kind: "cast_spell", spellId: "ray-of-frost", mode: "cantrip", payment: { kind: "none" } }],
    });
    const shown = ids(filterSpells(spent, filters({ availableNow: true })));

    expect(shown).not.toContain("ray-of-frost");
    expect(shown).toContain("shield");
    expect(shown).toContain("absorb-elements");
  });

  it("оплата кровью делает заклинание доступным без ячеек", () => {
    const character = withSpellPoints(spentThorne(), 2);

    expect(ids(filterSpells(book({ character }), filters({ availableNow: true })))).toContain(
      "mage-armor",
    );
  });

  it("в бою не показывает накладывание дольше хода (FR-033)", () => {
    const shown = ids(filterSpells(book(), filters({ availableNow: true })));

    expect(shown).not.toContain("mending");
    expect(shown).toContain("ray-of-frost");
  });

  it("скрытое фильтром названо причиной: вердикт и объяснение приходят вместе (FR-030)", () => {
    const hidden = outOfFight(spentThorne()).filter(
      (spell) => spell.unavailableReason !== undefined,
    );

    expect(hidden.length).toBeGreaterThan(0);
    const shown = ids(filterSpells(outOfFight(spentThorne()), filters({ availableNow: true })));
    for (const spell of hidden) {
      expect(shown, spell.nameRu).not.toContain(spell.id);
    }
  });
});

describe("filterSpells: роль в бою (FR-212, FR-213)", () => {
  it("«Защита» оставляет защитные, включая несущее урон «Поглощение стихий»", () => {
    const shown = ids(filterSpells(book(), filters({ roles: ["defense"] })));

    // «Поглощение стихий» несёт урон в данных и всё же защитное — ровно тот случай, ради которого
    // роль хранится, а не выводится.
    expect(shown).toContain("absorb-elements");
    expect(shown).toContain("shield");
    expect(shown).toContain("counterspell");
    expect(shown).not.toContain("lightning-bolt");
  });

  it("«Боевое» оставляет боевые", () => {
    const shown = ids(filterSpells(book(), filters({ roles: ["offense"] })));

    // «Паутина» урона не наносит и всё же боевая: она выключает противника.
    expect(shown).toContain("ray-of-frost");
    expect(shown).toContain("web");
    expect(shown).toContain("polymorph");
    expect(shown).not.toContain("mage-armor");
  });

  it("две роли соединяются «или», как и любые значения одной категории (FR-003)", () => {
    const shown = ids(filterSpells(book(), filters({ roles: ["offense", "defense"] })));
    expect(shown).toContain("ray-of-frost");
    expect(shown).toContain("shield");
    expect(shown).not.toContain("message");
  });

  it("роль соединяется с временем накладывания через «и»", () => {
    const both = filters({ roles: ["defense"], castingTimes: ["reaction"] });
    // Все четыре реакции книги защитные, кроме «Падения пёрышком» — оно тоже защитное.
    expect(ids(filterSpells(book(), both))).toEqual([
      "shield",
      "absorb-elements",
      "feather-fall",
      "counterspell",
    ]);
  });
});

describe("matchesTraits: строка, не являющаяся заклинанием (FR-207)", () => {
  it("«Магия крови» хода не занимает и отсеивается любым фильтром времени", () => {
    expect(matchesTraits(BLOOD_MAGIC_TRAITS, filters({ castingTimes: ["action"] }))).toBe(false);
    expect(matchesTraits(BLOOD_MAGIC_TRAITS, filters({ castingTimes: ["reaction"] }))).toBe(false);
  });

  it("её роль — «другое»: под «Боевое» и «Защиту» она не подходит", () => {
    expect(matchesTraits(BLOOD_MAGIC_TRAITS, filters({ roles: ["offense"] }))).toBe(false);
    expect(matchesTraits(BLOOD_MAGIC_TRAITS, filters({ roles: ["other"] }))).toBe(true);
  });

  it("концентрации она не держит", () => {
    expect(matchesTraits(BLOOD_MAGIC_TRAITS, filters({ concentration: true }))).toBe(false);
  });

  it("без фильтров проходит", () => {
    expect(matchesTraits(BLOOD_MAGIC_TRAITS, NO_FILTERS)).toBe(true);
  });
});

describe("matchesActionRow: книжные фильтры для строки-действия (FR-207, FR-212)", () => {
  it("«Подготовлено» её не прячет: подготовка к обмену не относится", () => {
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ prepared: true }))).toBe(true);
  });

  it("«Ритуал» прячет: обмен ритуалом не творится", () => {
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ ritual: true }))).toBe(false);
  });

  it("«Без ячейки» её оставляет, уровень ячейки — прячет: отбирают по цене", () => {
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ prices: [0] }))).toBe(true);
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ prices: [1] }))).toBe(false);
  });

  it("общие фильтры работают так же, как раньше", () => {
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ castingTimes: ["action"] }))).toBe(false);
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ roles: ["offense"] }))).toBe(false);
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, NO_FILTERS)).toBe(true);
  });
});

describe("toggleValue", () => {
  it("добавляет отсутствующее значение и убирает выбранное", () => {
    expect(toggleValue([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleValue([1, 2, 3], 2)).toEqual([1, 3]);
  });
});

describe("поиск по названию (FR-303)", () => {
  it("часть названия оставляет одну строку из пятнадцати", () => {
    expect(ids(filterSpells(book(), filters({ query: "молн" })))).toEqual(["lightning-bolt"]);
  });

  it("пустой запрос не ограничивает", () => {
    expect(filterSpells(book(), filters({ query: "" }))).toHaveLength(book().length);
  });

  it("регистр не важен: имя произносят, а не набирают по буквам", () => {
    expect(ids(filterSpells(book(), filters({ query: "МОЛНИЯ" })))).toEqual(["lightning-bolt"]);
  });

  it("«е» находит «ё»: на телефоне «ё» лежит под удержанием", () => {
    expect(ids(filterSpells(outOfFight(), filters({ query: "полет" })))).toEqual(["fly"]);
    expect(ids(filterSpells(outOfFight(), filters({ query: "перышком" })))).toEqual([
      "feather-fall",
    ]);
  });

  it("совпадение ищется в любом месте названия, не только в начале", () => {
    expect(ids(filterSpells(book(), filters({ query: "холода" })))).toEqual(["ray-of-frost"]);
  });

  it("ненайденное даёт пустой список, а не весь", () => {
    expect(filterSpells(book(), filters({ query: "жаба" }))).toHaveLength(0);
  });

  it("строка-действие отвечает на запрос своим названием (FR-207)", () => {
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ query: "кров" }))).toBe(true);
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ query: "молн" }))).toBe(false);
  });
});
