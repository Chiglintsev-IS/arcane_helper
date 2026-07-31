import { describe, expect, it } from "vitest";

import { createThorne } from "@/data/content/thorne/character";
import { loadThorneSpells } from "@/data/content/thorne";
import type { CharacterState } from "@/data/schemas/character";
import { ALL_TURN_RESOURCES, checkAvailability, type TurnResources } from "./availability";
import {
  canCastNow,
  castOptions,
  countHiddenRituals,
  filterSpells,
  NO_FILTERS,
  toggleValue,
  type SpellFilters,
} from "./filters";

const allSpells = loadThorneSpells();

function ids(spells: readonly { id: string }[]): string[] {
  return spells.map((spell) => spell.id);
}

function filters(overrides: Partial<SpellFilters> = {}): SpellFilters {
  return { ...NO_FILTERS, ...overrides };
}

function context(overrides: { character?: CharacterState; turn?: TurnResources } = {}) {
  return {
    character: overrides.character ?? createThorne(),
    turn: overrides.turn ?? ALL_TURN_RESOURCES,
  };
}

function withoutSlots(): CharacterState {
  const character = createThorne();
  const empty: CharacterState["spellSlots"] = {};
  for (const [level, slot] of Object.entries(character.spellSlots)) {
    empty[Number(level)] = { ...slot, remaining: 0 };
  }
  character.spellSlots = empty;
  return character;
}

describe("filterSpells: список без фильтров", () => {
  it("показывает заговоры и подготовленные, скрывая неподготовленные ритуалы (F-09)", () => {
    expect(ids(filterSpells(allSpells, NO_FILTERS, context()))).toEqual([
      "shocking-grasp",
      "ray-of-frost",
      "message",
      "mending",
      "shield",
      "absorb-elements",
      "mage-armor",
      "disguise-self",
    ]);
  });

  it("сообщает, сколько ритуалов скрыто, чтобы пустой список можно было объяснить", () => {
    expect(countHiddenRituals(allSpells, NO_FILTERS, context())).toBe(4);
    expect(countHiddenRituals(allSpells, filters({ ritual: true }), context())).toBe(0);
  });

  it("показывает ритуалы по фильтру «ритуал»", () => {
    expect(ids(filterSpells(allSpells, filters({ ritual: true }), context()))).toEqual([
      "find-familiar",
      "detect-magic",
      "identify",
      "unseen-servant",
    ]);
  });
});

describe("filterSpells: значения одной категории соединяются «или» (FR-003)", () => {
  it("время накладывания: действие", () => {
    expect(ids(filterSpells(allSpells, filters({ castingTimes: ["action"] }), context()))).toEqual([
      "shocking-grasp",
      "ray-of-frost",
      "message",
      "mage-armor",
      "disguise-self",
    ]);
  });

  it("время накладывания: действие или реакция", () => {
    const shown = ids(
      filterSpells(allSpells, filters({ castingTimes: ["action", "reaction"] }), context()),
    );
    expect(shown).toContain("shield");
    expect(shown).toContain("absorb-elements");
    expect(shown).toContain("ray-of-frost");
    expect(shown).not.toContain("mending");
  });

  it("уровень: заговоры и первый уровень вместе", () => {
    const onlyCantrips = ids(filterSpells(allSpells, filters({ levels: [0] }), context()));
    const both = ids(filterSpells(allSpells, filters({ levels: [0, 1] }), context()));

    expect(onlyCantrips).toEqual(["shocking-grasp", "ray-of-frost", "message", "mending"]);
    expect(both).toHaveLength(8);
  });
});

describe("filterSpells: категории соединяются «и» (FR-003)", () => {
  it("действие плюс заговор оставляют только заговоры действием", () => {
    expect(
      ids(filterSpells(allSpells, filters({ castingTimes: ["action"], levels: [0] }), context())),
    ).toEqual(["shocking-grasp", "ray-of-frost", "message"]);
  });

  it("несовместимые категории дают пустой список, а не ошибку", () => {
    expect(
      filterSpells(allSpells, filters({ castingTimes: ["reaction"], levels: [0] }), context()),
    ).toEqual([]);
  });
});

describe("filterSpells: концентрация и подготовка", () => {
  it("фильтр концентрации вместе с ритуалами находит «Обнаружение магии»", () => {
    expect(
      ids(filterSpells(allSpells, filters({ concentration: true, ritual: true }), context())),
    ).toEqual(["detect-magic"]);
  });

  it("фильтр «подготовлено» скрывает снятое с подготовки, но не заговоры (AC-05)", () => {
    const character = createThorne();
    character.preparedSpellIds = character.preparedSpellIds.filter((id) => id !== "shield");

    const shown = ids(filterSpells(allSpells, filters({ prepared: true }), context({ character })));
    expect(shown).not.toContain("shield");
    expect(shown).toContain("mage-armor");
    expect(shown).toContain("ray-of-frost");
  });
});

describe("filterSpells: «доступно сейчас» (FR-002)", () => {
  it("без свободных ячеек оставляет только заговоры", () => {
    const shown = ids(
      filterSpells(allSpells, filters({ availableNow: true }), context({ character: withoutSlots() })),
    );
    expect(shown).toEqual(["shocking-grasp", "ray-of-frost", "message", "mending"]);
  });

  it("израсходованное действие скрывает заклинания действием, но не реакции", () => {
    const turn = { ...ALL_TURN_RESOURCES, actionAvailable: false };
    const shown = ids(filterSpells(allSpells, filters({ availableNow: true }), context({ turn })));

    expect(shown).not.toContain("ray-of-frost");
    expect(shown).toContain("shield");
    expect(shown).toContain("absorb-elements");
  });

  it("оплата кровью делает заклинание доступным без ячеек", () => {
    const character = withoutSlots();
    character.spellPoints = { remaining: 2, createdAt: "2026-07-31T18:00:00.000Z" };

    expect(ids(filterSpells(allSpells, filters({ availableNow: true }), context({ character })))).toContain(
      "mage-armor",
    );
  });

  it("согласован с проверкой доступности мастера применения (FR-030)", () => {
    const character = withoutSlots();
    const turn = ALL_TURN_RESOURCES;
    const hidden = allSpells.filter((spell) => !canCastNow(spell, character, turn));

    expect(hidden.length).toBeGreaterThan(0);
    for (const spell of hidden) {
      const options = castOptions(spell, character);
      expect(options.length).toBeGreaterThan(0);
      for (const option of options) {
        const availability = checkAvailability({ spell, character, turn, ...option });
        expect(availability.available).toBe(false);
      }
    }
  });
});

describe("castOptions", () => {
  it("для заговора предлагает единственный способ — без оплаты", () => {
    const rayOfFrost = allSpells.find((spell) => spell.id === "ray-of-frost")!;
    expect(castOptions(rayOfFrost, createThorne())).toEqual([
      { mode: "cantrip", payment: { kind: "none" } },
    ]);
  });

  it("для заклинания перечисляет ячейки от своего уровня и выше", () => {
    const mageArmor = allSpells.find((spell) => spell.id === "mage-armor")!;
    expect(castOptions(mageArmor, createThorne())).toEqual([
      { mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      { mode: "normal", payment: { kind: "slot", slotLevel: 2 } },
      { mode: "normal", payment: { kind: "slot", slotLevel: 3 } },
      { mode: "normal", payment: { kind: "slot", slotLevel: 4 } },
      { mode: "normal", payment: { kind: "spell_points" } },
    ]);
  });

  it("не предлагает оплату кровью там, где её цена неизвестна", () => {
    const mageArmor = allSpells.find((spell) => spell.id === "mage-armor")!;
    const sixthLevel = { ...mageArmor, level: 6 };
    const character = createThorne();
    character.spellSlots = { ...character.spellSlots, 6: { maximum: 1, remaining: 1 } };

    expect(castOptions(sixthLevel, character)).toEqual([
      { mode: "normal", payment: { kind: "slot", slotLevel: 6 } },
    ]);
  });

  it("для ритуального заклинания добавляет ритуальный режим", () => {
    const identify = allSpells.find((spell) => spell.id === "identify")!;
    expect(castOptions(identify, createThorne())).toContainEqual({
      mode: "ritual",
      payment: { kind: "none" },
    });
  });
});

describe("toggleValue", () => {
  it("добавляет отсутствующее значение и убирает выбранное", () => {
    expect(toggleValue([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleValue([1, 2, 3], 2)).toEqual([1, 3]);
  });
});
