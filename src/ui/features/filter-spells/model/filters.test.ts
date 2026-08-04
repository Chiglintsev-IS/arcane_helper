/**
 * Отбор списка: какие категории делят список и что остаётся после переключателей.
 *
 * Проверяется на настоящей книге Торна и на её боевом составе: перечня категорий по режимам больше
 * нет, и единственный способ убедиться, что набор верен в обеих ситуациях, — посчитать его от
 * обоих списков.
 */

import { describe, expect, it } from "vitest";

import {
  NO_FILTERS,
  dividingCategories,
  filterSpells,
  matchesActionRow,
  matchesTraits,
  toggleValue,
  type SpellFilters,
} from "@/ui/features/filter-spells/model/filters";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import {
  ALL_TURN_RESOURCES,
  checkAvailability,
  type TurnResources,
} from "@/core/application/casting/availability";
import { canCastNow, castOptions } from "@/core/application/casting/castOptions";
import { BLOOD_MAGIC_TRAITS } from "@/ui/shared/model/actionTraits";
import { spellsForScreen } from "@/ui/shared/model/spellList";

const SPELLS = loadThorneSpells();

function categoriesOf(inFight: boolean) {
  return dividingCategories(spellsForScreen(SPELLS, createThorne(), "play", inFight), inFight);
}

function ids(spells: readonly { id: string }[]): string[] {
  return spells.map((spell) => spell.id);
}

function filters(overrides: Partial<SpellFilters> = {}): SpellFilters {
  return { ...NO_FILTERS, ...overrides };
}

/** Бой не начат: только тогда у ритуального заклинания есть ритуальный способ. */
function outOfFight() {
  return context({ turn: ALL_TURN_RESOURCES });
}

function context(overrides: { character?: CharacterState; turn?: TurnResources } = {}) {
  return {
    character: overrides.character ?? createThorne(),
    // Бой уже начат: этот файл проверяет фильтры, а не сам факт начала боя ( — в
    // availability.test.ts).
    turn: overrides.turn ?? { ...ALL_TURN_RESOURCES, inFight: true },
  };
}

/** Идёт бой: счёт ходов ведётся. Раньше это следовало из режима экрана, теперь — из хода. */
const IN_COMBAT_TURN = { ...ALL_TURN_RESOURCES, inFight: true };

function withoutSlots(): CharacterState {
  const character = createThorne();
  const empty: CharacterState["spellSlots"] = {};
  for (const [level, slot] of Object.entries(character.spellSlots)) {
    empty[Number(level)] = { ...slot, remaining: 0 };
  }
  character.spellSlots = empty;
  return character;
}

describe("dividingCategories", () => {
  it("категория, которой отвечает весь список, переключателя не получает", () => {
    const allConcentrating = SPELLS.filter((spell) => spell.concentration);
    expect(dividingCategories(allConcentrating, false).concentration).toBe(false);
  });

  it("категория, которой не отвечает никто, переключателя не получает", () => {
    const noRituals = SPELLS.filter((spell) => !spell.ritual);
    expect(dividingCategories(noRituals, false).ritual).toBe(false);
  });

  it("пустой список не предлагает ничего", () => {
    const empty = dividingCategories([], false);

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
    expect(ids(filterSpells(SPELLS, NO_FILTERS, context()))).toEqual(ids(SPELLS));
  });

  it("показывает ритуалы по фильтру «ритуал»", () => {
    // «Ритуал» спрашивает про способ: он есть, только пока бой не идёт.
    expect(ids(filterSpells(SPELLS, filters({ ritual: true }), outOfFight()))).toEqual([
      "find-familiar",
      "detect-magic",
      "identify",
      "unseen-servant",
    ]);
  });
});

describe("filterSpells: значения одной категории соединяются «или» (FR-003)", () => {
  it("время накладывания: действие", () => {
    const shown = ids(filterSpells(SPELLS, filters({ castingTimes: ["action"] }), context()));

    expect(shown).toContain("ray-of-frost");
    expect(shown).toContain("mage-armor");
    // Реакции, бонусные действия и долгое накладывание отсеиваются.
    expect(shown).not.toContain("shield");
    expect(shown).not.toContain("misty-step");
    expect(shown).not.toContain("mending");
  });

  it("время накладывания: действие или реакция", () => {
    const shown = ids(
      filterSpells(SPELLS, filters({ castingTimes: ["action", "reaction"] }), context()),
    );
    expect(shown).toContain("shield");
    expect(shown).toContain("absorb-elements");
    expect(shown).toContain("ray-of-frost");
    expect(shown).not.toContain("mending");
  });

  it("цена: без ячейки и первый уровень вместе", () => {
    const onlyCantrips = ids(filterSpells(SPELLS, filters({ prices: [0] }), context()));
    const both = ids(filterSpells(SPELLS, filters({ prices: [0, 1] }), context()));

    expect(onlyCantrips).toEqual(["shocking-grasp", "ray-of-frost", "message", "mending"]);
    // Четыре заговора и девять заклинаний первого уровня.
    expect(both).toHaveLength(13);
  });
});

describe("filterSpells: категории соединяются «и» (FR-003)", () => {
  it("действие плюс заговор оставляют только заговоры действием", () => {
    expect(
      ids(filterSpells(SPELLS, filters({ castingTimes: ["action"], prices: [0] }), context())),
    ).toEqual(["shocking-grasp", "ray-of-frost", "message"]);
  });

  it("несовместимые категории дают пустой список, а не ошибку", () => {
    expect(
      filterSpells(SPELLS, filters({ castingTimes: ["reaction"], prices: [0] }), context()),
    ).toEqual([]);
  });
});

describe("filterSpells: концентрация и подготовка", () => {
  it("фильтр концентрации вместе с ритуалами находит «Обнаружение магии»", () => {
    expect(
      ids(filterSpells(SPELLS, filters({ concentration: true, ritual: true }), outOfFight())),
    ).toEqual(["detect-magic"]);
  });

  it("фильтр «подготовлено» скрывает снятое с подготовки, но не заговоры (AC-05)", () => {
    const character = createThorne();
    character.preparedSpellIds = character.preparedSpellIds.filter((id) => id !== "shield");

    const shown = ids(filterSpells(SPELLS, filters({ prepared: true }), context({ character })));
    expect(shown).not.toContain("shield");
    expect(shown).toContain("mage-armor");
    expect(shown).toContain("ray-of-frost");
  });
});

describe("filterSpells: «доступно сейчас» (FR-002)", () => {
  it("без свободных ячеек оставляет только заговоры", () => {
    const shown = ids(
      filterSpells(
        SPELLS,
        filters({ availableNow: true }),
        context({ character: withoutSlots(), turn: IN_COMBAT_TURN }),
      ),
    );
    // «Починки» здесь нет, хотя она заговор: минута не укладывается в ход, а режим — «Бой».
    expect(shown).toEqual(["shocking-grasp", "ray-of-frost", "message"]);
  });

  it("израсходованное действие скрывает заклинания действием, но не реакции", () => {
    const turn = { ...ALL_TURN_RESOURCES, inFight: true, actionAvailable: false };
    const shown = ids(filterSpells(SPELLS, filters({ availableNow: true }), context({ turn })));

    expect(shown).not.toContain("ray-of-frost");
    expect(shown).toContain("shield");
    expect(shown).toContain("absorb-elements");
  });

  it("оплата кровью делает заклинание доступным без ячеек", () => {
    const character = withoutSlots();
    character.spellPoints = { remaining: 2 };

    expect(
      ids(filterSpells(SPELLS, filters({ availableNow: true }), context({ character }))),
    ).toContain("mage-armor");
  });

  it("в бою не показывает накладывание дольше хода (FR-033)", () => {
    const character = createThorne();

    const shown = ids(
      filterSpells(
        SPELLS,
        filters({ availableNow: true }),
        context({ character, turn: IN_COMBAT_TURN }),
      ),
    );
    expect(shown).not.toContain("mending");
    expect(shown).toContain("ray-of-frost");
  });

  it("согласован с проверкой доступности мастера применения (FR-030)", () => {
    const character = withoutSlots();
    const turn = ALL_TURN_RESOURCES;
    const hidden = SPELLS.filter((spell) => !canCastNow(spell, character, turn));

    expect(hidden.length).toBeGreaterThan(0);
    for (const spell of hidden) {
      const options = castOptions(spell, character, { inCombat: false });
      expect(options.length).toBeGreaterThan(0);
      for (const option of options) {
        const availability = checkAvailability({ spell, character, turn, ...option });
        expect(availability.available).toBe(false);
      }
    }
  });
});

describe("filterSpells: роль в бою (FR-212, FR-213)", () => {
  it("«Защита» оставляет защитные, включая несущее урон «Поглощение стихий»", () => {
    const shown = ids(filterSpells(SPELLS, filters({ roles: ["defense"] }), context()));

    // «Поглощение стихий» несёт урон в данных и всё же защитное — ровно тот случай, ради которого
    // роль хранится, а не выводится.
    expect(shown).toContain("absorb-elements");
    expect(shown).toContain("shield");
    expect(shown).toContain("counterspell");
    expect(shown).not.toContain("lightning-bolt");
  });

  it("«Боевое» оставляет боевые", () => {
    const shown = ids(filterSpells(SPELLS, filters({ roles: ["offense"] }), context()));

    // «Паутина» урона не наносит и всё же боевая: она выключает противника.
    expect(shown).toContain("ray-of-frost");
    expect(shown).toContain("web");
    expect(shown).toContain("polymorph");
    expect(shown).not.toContain("mage-armor");
  });

  it("две роли соединяются «или», как и любые значения одной категории (FR-003)", () => {
    const shown = ids(filterSpells(SPELLS, filters({ roles: ["offense", "defense"] }), context()));
    expect(shown).toContain("ray-of-frost");
    expect(shown).toContain("shield");
    expect(shown).not.toContain("message");
  });

  it("роль соединяется с временем накладывания через «и»", () => {
    const both = filters({ roles: ["defense"], castingTimes: ["reaction"] });
    // Все четыре реакции книги защитные, кроме «Падения пёрышком» — оно тоже защитное.
    expect(ids(filterSpells(SPELLS, both, context()))).toEqual([
      "shield",
      "absorb-elements",
      "feather-fall",
      "counterspell",
    ]);
  });
});

describe("matchesTraits: строка, не являющаяся заклинанием (FR-207)", () => {
  it("«Магия крови» проходит фильтр действия и отсеивается фильтром реакции", () => {
    expect(matchesTraits(BLOOD_MAGIC_TRAITS, filters({ castingTimes: ["action"] }))).toBe(true);
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
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ castingTimes: ["action"] }))).toBe(true);
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
