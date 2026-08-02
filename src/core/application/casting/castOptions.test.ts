import { BLOOD_MAGIC_TRAITS, traitsOf } from "@/ui/shared/model/actionTraits";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/character/state";
import { ALL_TURN_RESOURCES, checkAvailability, type TurnResources } from "@/core/application/casting/availability";
import { bestCastPlan, canCastNow, castOptions } from "@/core/application/casting/castOptions";
import { NO_FILTERS, filterSpells, matchesActionRow, matchesTraits, toggleValue, type SpellFilters } from "@/ui/features/filter-spells/model/filters";

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
    // Бой уже начат: этот файл проверяет фильтры, а не сам факт начала боя ( — в
    // availability.test.ts).
    turn: overrides.turn ?? { ...ALL_TURN_RESOURCES, inFight: true },
  };
}

/**
 * Торн вне боя. Ритуальный способ существует только здесь: в бою он убран, потому что занимает на
 * 10 минут больше обычного, а начальный режим персонажа — «Бой».
 */
function outsideCombat(): CharacterState {
  return createThorne();
}

/** Идёт бой: счёт ходов ведётся. Раньше это следовало из режима экрана, теперь — из хода. */
const IN_COMBAT_TURN = { ...ALL_TURN_RESOURCES, inFight: true, tracksTurn: true };

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
  it("ничего не скрывает: отбор по ситуации — дело режима, а не фильтров", () => {
    // Неподготовленные ритуалы раньше пропадали из списка и доставались фильтром «Ритуал». Правило
    // писалось для боя, где их и так нет, а на привале прятало сам смысл режима.
    expect(ids(filterSpells(allSpells, NO_FILTERS, context()))).toEqual(ids(allSpells));
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
    const shown = ids(filterSpells(allSpells, filters({ castingTimes: ["action"] }), context()));

    expect(shown).toContain("ray-of-frost");
    expect(shown).toContain("mage-armor");
    // Реакции, бонусные действия и долгое накладывание отсеиваются.
    expect(shown).not.toContain("shield");
    expect(shown).not.toContain("misty-step");
    expect(shown).not.toContain("mending");
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
    // Четыре заговора и девять заклинаний первого уровня.
    expect(both).toHaveLength(13);
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
      filterSpells(
        allSpells,
        filters({ availableNow: true }),
        context({ character: withoutSlots(), turn: IN_COMBAT_TURN }),
      ),
    );
    // «Починки» здесь нет, хотя она заговор: минута не укладывается в ход, а режим — «Бой».
    expect(shown).toEqual(["shocking-grasp", "ray-of-frost", "message"]);
  });

  it("израсходованное действие скрывает заклинания действием, но не реакции", () => {
    const turn = { ...ALL_TURN_RESOURCES, inFight: true, actionAvailable: false };
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

  it("в бою не показывает накладывание дольше хода (FR-033)", () => {
    const character = createThorne();

    const shown = ids(
      filterSpells(
        allSpells,
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
    const hidden = allSpells.filter((spell) => !canCastNow(spell, character, turn));

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
    const shown = ids(filterSpells(allSpells, filters({ roles: ["defense"] }), context()));

    // «Поглощение стихий» несёт урон в данных и всё же защитное — ровно тот случай, ради которого
    // роль хранится, а не выводится.
    expect(shown).toContain("absorb-elements");
    expect(shown).toContain("shield");
    expect(shown).toContain("counterspell");
    expect(shown).not.toContain("lightning-bolt");
  });

  it("«Боевое» оставляет боевые", () => {
    const shown = ids(filterSpells(allSpells, filters({ roles: ["offense"] }), context()));

    // «Паутина» урона не наносит и всё же боевая: она выключает противника.
    expect(shown).toContain("ray-of-frost");
    expect(shown).toContain("web");
    expect(shown).toContain("polymorph");
    expect(shown).not.toContain("mage-armor");
  });

  it("две роли соединяются «или», как и любые значения одной категории (FR-003)", () => {
    const shown = ids(filterSpells(allSpells, filters({ roles: ["offense", "defense"] }), context()));
    expect(shown).toContain("ray-of-frost");
    expect(shown).toContain("shield");
    expect(shown).not.toContain("message");
  });

  it("роль соединяется с временем накладывания через «и»", () => {
    const both = filters({ roles: ["defense"], castingTimes: ["reaction"] });
    // Все четыре реакции книги защитные, кроме «Падения пёрышком» — оно тоже защитное.
    expect(ids(filterSpells(allSpells, both, context()))).toEqual([
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

  it("признаки заклинания собираются той же функцией, что и признаки действия", () => {
    const shield = allSpells.find((spell) => spell.id === "shield");
    expect(traitsOf(shield!)).toEqual({
      castingTime: "reaction",
      level: 1,
      concentration: false,
      role: "defense",
    });
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
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ levels: [0] }))).toBe(true);
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ levels: [1] }))).toBe(false);
  });

  it("общие фильтры работают так же, как раньше", () => {
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ castingTimes: ["action"] }))).toBe(true);
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, filters({ roles: ["offense"] }))).toBe(false);
    expect(matchesActionRow(BLOOD_MAGIC_TRAITS, NO_FILTERS)).toBe(true);
  });
});

describe("castOptions", () => {
  it("для заговора предлагает единственный способ — без оплаты", () => {
    const rayOfFrost = allSpells.find((spell) => spell.id === "ray-of-frost")!;
    expect(castOptions(rayOfFrost, createThorne(), { inCombat: true })).toEqual([
      { mode: "cantrip", payment: { kind: "none" } },
    ]);
  });

  it("для заклинания перечисляет ячейки от своего уровня и выше", () => {
    const mageArmor = allSpells.find((spell) => spell.id === "mage-armor")!;
    expect(castOptions(mageArmor, createThorne(), { inCombat: true })).toEqual([
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

    expect(castOptions(sixthLevel, character, { inCombat: true })).toEqual([
      { mode: "normal", payment: { kind: "slot", slotLevel: 6 } },
    ]);
  });

  it("для ритуального заклинания добавляет ритуальный режим", () => {
    const identify = allSpells.find((spell) => spell.id === "identify")!;
    expect(castOptions(identify, outsideCombat(), { inCombat: false })).toContainEqual({
      mode: "ritual",
      payment: { kind: "none" },
    });
  });

  it("в бою ритуального способа нет: +10 минут в раунд не помещаются (FR-208)", () => {
    const detectMagic = allSpells.find((spell) => spell.id === "detect-magic")!;
    const inCombat = castOptions(detectMagic, createThorne(), { inCombat: true });

    expect(inCombat).not.toContainEqual({ mode: "ritual", payment: { kind: "none" } });
    // Ячейкой заклинание при этом остаётся доступно: убран способ, а не заклинание.
    expect(inCombat).toContainEqual({ mode: "normal", payment: { kind: "slot", slotLevel: 1 } });
  });
});

describe("bestCastPlan", () => {
  const detectMagic = allSpells.find((spell) => spell.id === "detect-magic")!;
  const mageArmor = allSpells.find((spell) => spell.id === "mage-armor")!;

  it("для неподготовленного ритуала выбирает ритуал, а не ячейку (FR-103)", () => {
    const plan = bestCastPlan(detectMagic, outsideCombat(), ALL_TURN_RESOURCES);

    expect(plan?.option).toEqual({ mode: "ritual", payment: { kind: "none" } });
    expect(plan?.availability.available).toBe(true);
  });

  it("в бою тот же ритуал разрешается ячейкой (FR-208)", () => {
    // Способ, которого нет, не может оказаться лучшим: в бою остаётся оплата ячейкой, и она же
    // объясняет доступность.
    const plan = bestCastPlan(detectMagic, createThorne(), IN_COMBAT_TURN);

    expect(plan?.option).toEqual({ mode: "normal", payment: { kind: "slot", slotLevel: 1 } });
  });

  it("объясняет недоступность причиной лучшего способа, а не первого попавшегося", () => {
    // Ритуалу подготовка не нужна, поэтому мешает ему только занятая концентрация. Причина
    // «не подготовлено» пришла бы от ячейки — способа, которым это заклинание и не творят.
    const character = outsideCombat();
    character.concentration = { spellId: "web", startedAt: "2026-07-31T18:00:00.000Z" };

    const plan = bestCastPlan(detectMagic, character, ALL_TURN_RESOURCES);

    expect(plan?.availability.warnings.map((warning) => warning.code)).toEqual([
      "concentration_busy",
    ]);
  });

  it("без способов сотворения возвращает null", () => {
    const character = createThorne();
    character.spellSlots = {};
    const sixthLevel = { ...mageArmor, level: 6 };

    expect(bestCastPlan(sixthLevel, character, ALL_TURN_RESOURCES)).toBeNull();
  });
});

describe("toggleValue", () => {
  it("добавляет отсутствующее значение и убирает выбранное", () => {
    expect(toggleValue([1, 2], 3)).toEqual([1, 2, 3]);
    expect(toggleValue([1, 2, 3], 2)).toEqual([1, 3]);
  });
});
