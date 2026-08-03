import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import {
  ACTION_SPENT_MESSAGES,
  ALL_TURN_RESOURCES,
  checkAvailability,
  exchangeWarnings,
  reasonsOf,
  withoutConsent,
  type AvailabilityInput,
  type AvailabilityWarning,
} from "@/core/application/casting/availability";

const spells = new Map(loadThorneSpells().map((spell) => [spell.id, spell]));

function spell(id: string): Spell {
  const found = spells.get(id);
  if (found === undefined) throw new Error(`нет карточки ${id}`);
  return found;
}

/** Заговор действием, заклинание действием, реакция, ритуал — по одному на каждую ветку. */
const rayOfFrost = spell("ray-of-frost");
const mageArmor = spell("mage-armor");
const shield = spell("shield");
const detectMagic = spell("detect-magic");
const identify = spell("identify");
const mending = spell("mending");
const findFamiliar = spell("find-familiar");

function check(overrides: Partial<AvailabilityInput> & { spell: Spell }) {
  const input: AvailabilityInput = {
    character: createThorne(),
    // Бой уже начат: только тогда ход считается, и проверки хода вообще что-то говорят.
    turn: { ...ALL_TURN_RESOURCES, inFight: true },
    mode: overrides.spell.level === 0 ? "cantrip" : "normal",
    payment:
      overrides.spell.level === 0
        ? { kind: "none" }
        : { kind: "slot", slotLevel: overrides.spell.level },
    ...overrides,
  };
  return checkAvailability(input);
}

describe("checkAvailability: заклинание, готовое к применению", () => {
  it("подготовленное заклинание с ячейкой и действием доступно", () => {
    const availability = check({ spell: mageArmor });
    expect(availability.available).toBe(true);
    expect(availability.warnings).toEqual([]);
  });

  it("заговор доступен без ячейки и без подготовки", () => {
    const availability = check({ spell: rayOfFrost });
    expect(availability.available).toBe(true);
    expect(availability.warnings).toEqual([]);
  });
});

describe("checkAvailability: подготовка и режим (FR-030)", () => {
  it("предупреждает о неподготовленном заклинании из книги", () => {
    const availability = check({ spell: detectMagic, mode: "normal" });
    expect(reasonsOf(availability, "not_prepared")).toEqual([
      "Заклинание не подготовлено",
    ]);
  });

  it("ритуальное применение не требует подготовки", () => {
    const availability = check({
      spell: detectMagic,
      mode: "ritual",
      payment: { kind: "none" },
    });
    expect(availability.available).toBe(true);
  });

  it("предупреждает, если заклинание не ритуальное, а режим ритуальный", () => {
    const availability = check({
      spell: mageArmor,
      mode: "ritual",
      payment: { kind: "none" },
    });
    expect(reasonsOf(availability, "not_ritual")).toEqual([
      "«Доспехи мага» нельзя сотворить ритуалом",
    ]);
  });

  it("не предупреждает о подготовке неизвестного заклинания дважды", () => {
    const stranger: Spell = { ...mageArmor, id: "fireball" };
    const availability = check({ spell: stranger });
    expect(reasonsOf(availability, "not_in_spellbook")).toEqual([
      "Заклинания нет в книге заклинаний",
    ]);
    expect(reasonsOf(availability, "not_prepared")).toEqual([]);
  });
});

describe("checkAvailability: экономия хода (FR-030, FR-141)", () => {
  it("предупреждает об израсходованном действии", () => {
    const availability = check({
      spell: mageArmor,
      turn: { ...ALL_TURN_RESOURCES, actionAvailable: false },
    });
    expect(reasonsOf(availability, "action_spent")).toEqual(["Действие уже израсходовано"]);
  });

  it("предупреждает об израсходованной реакции", () => {
    const availability = check({
      spell: shield,
      turn: { ...ALL_TURN_RESOURCES, reactionAvailable: false },
    });
    expect(reasonsOf(availability, "reaction_spent")).toEqual(["Реакция уже израсходована"]);
  });

  it("бонусное действие проверяется отдельно от действия", () => {
    const bonusSpell: Spell = { ...mageArmor, castingTime: { type: "bonus_action" } };
    const availability = check({
      spell: bonusSpell,
      turn: { ...ALL_TURN_RESOURCES, bonusActionAvailable: false, actionAvailable: true },
    });
    expect(reasonsOf(availability, "bonus_action_spent")).toEqual([
      "Бонусное действие уже израсходовано",
    ]);
  });

  it("накладывание в минуты и часы экономию хода не тратит", () => {
    const availability = check({
      spell: identify,
      mode: "ritual",
      payment: { kind: "none" },
      turn: {
        actionAvailable: false,
        bonusActionAvailable: false,
        reactionAvailable: false,
        inFight: true,
      },
    });
    expect(reasonsOf(availability, "action_spent")).toEqual([]);
    expect(reasonsOf(availability, "bonus_action_spent")).toEqual([]);
    expect(reasonsOf(availability, "reaction_spent")).toEqual([]);
  });
});

describe("checkAvailability: накладывание дольше хода (FR-033)", () => {
  /** Предупреждение о минутах имеет смысл только там, где ход считается. */
  function inCombat(): CharacterState {
    return createThorne();
  }

  it("минуты предупреждают о цене по правилам и называют время", () => {
    const availability = check({ spell: mending, character: inCombat() });
    expect(reasonsOf(availability, "long_casting_time")).toEqual([
      "Не уложится в один ход — 1 минута, действие каждый ход и концентрация",
    ]);
  });

  it("часы называют время в своих единицах", () => {
    const availability = check({
      spell: findFamiliar,
      character: inCombat(),
      mode: "ritual",
      payment: { kind: "none" },
    });
    expect(reasonsOf(availability, "long_casting_time")).toEqual([
      "Не уложится в один ход — 1 час, действие каждый ход и концентрация",
    ]);
  });

  it("предупреждение проходимо: мастер вправе разрешить исключение (FR-031)", () => {
    expect(
      check({ spell: mending, character: inCombat() }).warnings.every(
        (warning) => warning.enforcement !== "ending_concentration",
      ),
    ).toBe(true);
  });

  it("заклинание действием такого предупреждения не получает", () => {
    expect(reasonsOf(check({ spell: rayOfFrost, character: inCombat() }), "long_casting_time"))
      .toEqual([]);
  });

  it("без числа в данных молчит: назвать время нечем, а половина предупреждения хуже тишины", () => {
    // Схема такого не пропускает, но тип допускает: импорт чужих данных не должен ломать проверку.
    const broken: Spell = { ...mending, castingTime: { type: "minute" } };
    expect(reasonsOf(check({ spell: broken, character: inCombat() }), "long_casting_time")).toEqual([]);
  });

  it("вне боя молчит: на привале минута ничего не стоит (FR-143)", () => {
    const availability = check({
      spell: mending,
      character: createThorne(),
      turn: ALL_TURN_RESOURCES,
    });
    expect(availability.warnings).toEqual([]);
    expect(availability.available).toBe(true);
  });
});

describe("checkAvailability: оплата (FR-030, FR-070)", () => {
  function withoutSlots(level: number): CharacterState {
    const character = createThorne();
    const slot = character.spellSlots[level];
    if (slot === undefined) throw new Error(`нет ячеек ${level} уровня`);
    character.spellSlots = { ...character.spellSlots, [level]: { ...slot, remaining: 0 } };
    return character;
  }

  it("предупреждает об отсутствии свободной ячейки", () => {
    const availability = check({ spell: mageArmor, character: withoutSlots(1) });
    expect(reasonsOf(availability, "no_slot")).toEqual(["Нет свободной ячейки 1 уровня"]);
  });

  it("предупреждает о ячейке ниже уровня заклинания", () => {
    const secondLevel: Spell = { ...mageArmor, level: 2 };
    const availability = check({
      spell: secondLevel,
      payment: { kind: "slot", slotLevel: 1 },
    });
    expect(reasonsOf(availability, "slot_too_low")).toEqual([
      "Ячейка 1 уровня ниже уровня заклинания — нужен 2",
    ]);
  });

  it("предупреждает об уровне ячейки, которого у персонажа нет вовсе", () => {
    const availability = check({
      spell: mageArmor,
      payment: { kind: "slot", slotLevel: 9 },
    });
    expect(reasonsOf(availability, "no_slot")).toEqual(["Ячеек 9 уровня у персонажа нет"]);
  });

  it("предупреждает о нехватке очков заклинаний", () => {
    const availability = check({ spell: mageArmor, payment: { kind: "spell_points" } });
    expect(reasonsOf(availability, "not_enough_spell_points")).toEqual([
      "Очков заклинаний 0, нужно 2 — это 6 хитов кровью",
    ]);
  });

  it("оплата очками доступна, когда очков хватает", () => {
    const character = createThorne();
    character.spellPoints = { remaining: 3 };
    const availability = check({
      spell: mageArmor,
      character,
      payment: { kind: "spell_points" },
    });
    expect(availability.available).toBe(true);
  });

  it("заговор с выбранной ячейкой — ошибка данных, а не предупреждение", () => {
    expect(() =>
      check({ spell: rayOfFrost, payment: { kind: "slot", slotLevel: 1 } }),
    ).toThrow(/не расходует ячейку/);
  });

  it("ритуал с выбранной ячейкой — ошибка данных, а не предупреждение", () => {
    expect(() =>
      check({ spell: identify, mode: "ritual", payment: { kind: "slot", slotLevel: 1 } }),
    ).toThrow(/Ритуальное применение не расходует ячейку/);
  });

  it("заклинание без способа оплаты предупреждает, а не молчит", () => {
    const availability = check({ spell: mageArmor, payment: { kind: "none" } });
    expect(reasonsOf(availability, "no_payment")).toEqual([
      "Не выбран способ оплаты: ячейка или очки заклинаний",
    ]);
  });
});

describe("checkAvailability: концентрация (FR-030, FR-081)", () => {
  function concentrating(): CharacterState {
    const character = createThorne();
    character.concentration = { spellId: "detect-magic", startedAt: "2026-07-31T18:00:00.000Z" };
    character.activeEffects = [
      {
        id: "effect-1",
        spellId: "detect-magic",
        nameRu: "Обнаружение магии",
        startedAt: "2026-07-31T18:00:00.000Z",
        duration: { type: "minutes", value: 10 },
        isConcentration: true,
        slotLevelUsed: 1,
        endConditionRu: "До конца концентрации или истечения длительности.",
      },
    ];
    return character;
  }

  it("предупреждает о замене концентрации и называет текущий эффект", () => {
    const availability = check({
      spell: detectMagic,
      character: concentrating(),
      mode: "ritual",
      payment: { kind: "none" },
    });
    expect(reasonsOf(availability, "concentration_busy")).toEqual([
      "Уже идёт концентрация: «Обнаружение магии» завершится",
    ]);
  });

  it("замену концентрации нельзя пройти кнопкой «Применить всё равно»", () => {
    const availability = check({
      spell: detectMagic,
      character: concentrating(),
      mode: "ritual",
      payment: { kind: "none" },
    });
    const warning = availability.warnings.find((item) => item.code === "concentration_busy");
    expect(warning?.enforcement).toBe("ending_concentration");
  });

  it("на испорченном состоянии без эффекта называет заклинание по идентификатору", () => {
    const broken = concentrating();
    broken.activeEffects = [];
    const availability = check({
      spell: detectMagic,
      character: broken,
      mode: "ritual",
      payment: { kind: "none" },
    });
    expect(reasonsOf(availability, "concentration_busy")).toEqual([
      "Уже идёт концентрация: «detect-magic» завершится",
    ]);
  });

  it("неконцентрационное заклинание при активной концентрации не предупреждает", () => {
    const availability = check({ spell: mageArmor, character: concentrating() });
    expect(availability.warnings).toEqual([]);
  });
});

describe("checkAvailability: компоненты (FR-030, OQ-06)", () => {
  it("перечисляет действия словами, а не аббревиатурой «В, С, М»", () => {
    expect(check({ spell: mageArmor }).componentReminders).toEqual([
      "Произнести вслух",
      "Жест свободной рукой",
      "Компонент: кусок обработанной кожи",
    ]);
  });

  it("предупреждает, что фокусировка не заменяет компонент со стоимостью", () => {
    const reminders = check({
      spell: identify,
      mode: "ritual",
      payment: { kind: "none" },
    }).componentReminders;
    // Жемчужина «Опознания» стоит 100 зм и фокусировкой не заменяется, но заклинанием не
    // расходуется: в описании этого не сказано, а по общему правилу материал тратится только
    // тогда, когда это сказано прямо. Расходуемый компонент проверяется следующим тестом.
    expect(reminders).toContain(
      "Компонент: жемчужина стоимостью не менее 100 зм — 100 зм, фокусировка не заменяет",
    );
  });

  it("отмечает расходуемый компонент", () => {
    const consuming: Spell = {
      ...identify,
      components: { ...identify.components, consumed: true },
    };
    const reminders = check({
      spell: consuming,
      mode: "ritual",
      payment: { kind: "none" },
    }).componentReminders;
    expect(reminders.at(-1)).toMatch(/расходуется/);
  });

  it("заклинание без компонентов напоминаний не порождает", () => {
    const silent: Spell = {
      ...mageArmor,
      components: { verbal: false, somatic: false, material: false },
    };
    expect(check({ spell: silent }).componentReminders).toEqual([]);
  });
});

describe("checkAvailability: несколько нарушений сразу", () => {
  it("собирает все предупреждения, а не первое", () => {
    const availability = check({
      spell: detectMagic,
      mode: "normal",
      turn: { ...ALL_TURN_RESOURCES, inFight: true, actionAvailable: false },
    });
    expect(availability.warnings.map((warning) => warning.code)).toEqual([
      "not_prepared",
      "action_spent",
    ]);
    expect(availability.available).toBe(false);
  });

  it("«Применить всё равно» доступно, пока среди предупреждений нет замены концентрации", () => {
    const availability = check({
      spell: detectMagic,
      mode: "normal",
      turn: { ...ALL_TURN_RESOURCES, inFight: true, actionAvailable: false },
    });
    expect(
      availability.warnings.every((warning) => warning.enforcement !== "ending_concentration"),
    ).toBe(true);
  });
});

describe("наличие компонентов (FR-030, OQ-06)", () => {
  const identify = spell("identify");
  const mageArmor = spell("mage-armor");

  function withEquipment(
    components: NonNullable<CharacterState["equipment"]["components"]>,
  ): CharacterState {
    const base = createThorne();
    return { ...base, equipment: { ...base.equipment, components } };
  }

  it("дорогого компонента нет в сумке — предупреждение с ценой", () => {
    const warnings = checkAvailability({
      spell: identify,
      character: createThorne(),
      turn: ALL_TURN_RESOURCES,
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
    }).warnings;

    const missing = warnings.find((warning) => warning.code === "no_component");
    expect(missing?.reasonRu).toContain("100 зм");
    // Проходимо: мастер вправе разрешить, а игрок — вспомнить, что жемчужина всё-таки есть.
    expect(missing?.enforcement).toBe("advisory");
  });

  it("купленный компонент предупреждения не даёт", () => {
    const bought = withEquipment({
      spellcastingFocus: true,
      componentPouch: false,
      materialsForSpellIds: ["identify"],
    });
    const warnings = checkAvailability({
      spell: identify,
      character: bought,
      turn: ALL_TURN_RESOURCES,
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
    }).warnings;

    expect(warnings.some((warning) => warning.code === "no_component")).toBe(false);
  });

  it("компонент без стоимости закрывает фокусировка", () => {
    const warnings = checkAvailability({
      spell: mageArmor,
      character: createThorne(),
      turn: ALL_TURN_RESOURCES,
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
    }).warnings;

    expect(warnings.some((warning) => warning.code === "no_component")).toBe(false);
  });

  it("без фокусировки и мешочка не закрывает ничего", () => {
    const empty = withEquipment({
      spellcastingFocus: false,
      componentPouch: false,
      materialsForSpellIds: [],
    });
    const warnings = checkAvailability({
      spell: mageArmor,
      character: empty,
      turn: ALL_TURN_RESOURCES,
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
    }).warnings;

    expect(warnings.find((warning) => warning.code === "no_component")?.reasonRu).toContain(
      "ни мешочка",
    );
  });

  it("мешочек заменяет фокусировку", () => {
    const pouch = withEquipment({
      spellcastingFocus: false,
      componentPouch: true,
      materialsForSpellIds: [],
    });
    const warnings = checkAvailability({
      spell: mageArmor,
      character: pouch,
      turn: ALL_TURN_RESOURCES,
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
    }).warnings;

    expect(warnings.some((warning) => warning.code === "no_component")).toBe(false);
  });

  it("расходуемый компонент без цены и без описания тоже называется", () => {
    // Такое приходит импортом чужой книги: цена не указана, текста нет — но расходуемое
    // фокусировка всё равно не заменяет, и молчать об этом нельзя.
    const imported: Spell = {
      ...identify,
      components: { verbal: true, somatic: true, material: true, consumed: true },
    };
    const warnings = checkAvailability({
      spell: imported,
      character: createThorne(),
      turn: ALL_TURN_RESOURCES,
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
    }).warnings;

    expect(warnings.find((warning) => warning.code === "no_component")?.reasonRu).toBe(
      "Нет компонента: материальный компонент",
    );
  });

  it("состоянию без записи о снаряжении вердикта не выдумывает", () => {
    const base = createThorne();
    const { components: _none, ...withoutComponents } = base.equipment;
    const unknown = { ...base, equipment: withoutComponents };
    const warnings = checkAvailability({
      spell: identify,
      character: unknown,
      turn: ALL_TURN_RESOURCES,
      mode: "normal",
      payment: { kind: "slot", slotLevel: 1 },
    }).warnings;

    expect(warnings.some((warning) => warning.code === "no_component")).toBe(false);
  });
});


describe("исполнение предупреждений по объявлению", () => {
  const advisory: AvailabilityWarning = {
    code: "not_prepared",
    reasonRu: "Заклинание не подготовлено",
    enforcement: "advisory",
  };
  const exception: AvailabilityWarning = {
    code: "no_payment",
    reasonRu: "Не выбран способ оплаты",
    enforcement: "gm_exception",
  };
  const concentration: AvailabilityWarning = {
    code: "concentration_busy",
    reasonRu: "Уже идёт концентрация",
    enforcement: "ending_concentration",
  };

  it("предупреждающее не требует согласия", () => {
    expect(withoutConsent([advisory], {})).toBeUndefined();
  });

  it("без согласия отказывает первым же исполняемым", () => {
    expect(withoutConsent([advisory, exception], {})).toBe(exception);
  });

  it("исключение мастера снимает своё и не снимает чужого", () => {
    expect(withoutConsent([exception], { gm_exception: true })).toBeUndefined();
    expect(withoutConsent([concentration], { gm_exception: true })).toBe(concentration);
  });

  it("согласие на замену концентрации снимает своё и не снимает чужого", () => {
    expect(withoutConsent([concentration], { ending_concentration: true })).toBeUndefined();
    expect(withoutConsent([exception], { ending_concentration: true })).toBe(exception);
  });

  it("ячейка ниже уровня заклинания отказывает, пока мастер не разрешил", () => {
    const secondLevel: Spell = { ...mageArmor, level: 2 };
    const { warnings } = check({ spell: secondLevel, payment: { kind: "slot", slotLevel: 1 } });
    expect(withoutConsent(warnings, {})?.code).toBe("slot_too_low");
    expect(withoutConsent(warnings, { gm_exception: true })).toBeUndefined();
  });
});

describe("доступность обмена хитов на очки (FR-176, FR-143)", () => {
  it("вне боя действие не тратится, и причины нет", () => {
    // Экономия хода вне боя отвечает «всё доступно», и отдельной проверки на бой обмену не нужно.
    expect(exchangeWarnings(createThorne(), ALL_TURN_RESOURCES)).toEqual([]);
  });

  it("подавление огнём и солнцем называется своими словами", () => {
    const burned = createThorne();
    burned.suppression = { firedUpon: true, underDirectSunlight: false };
    expect(exchangeWarnings(burned, ALL_TURN_RESOURCES)).toEqual([
      "Кровавое колдовство подавлено уроном огнём до конца следующего хода",
    ]);

    const sunlit = createThorne();
    sunlit.suppression = { firedUpon: false, underDirectSunlight: true };
    expect(exchangeWarnings(sunlit, ALL_TURN_RESOURCES)).toEqual([
      "Кровавое колдовство не действует под прямым солнечным светом",
    ]);
  });

  it("израсходованное действие названо теми же словами, что и у заклинания", () => {
    const spent = { ...ALL_TURN_RESOURCES, inFight: true, actionAvailable: false };
    expect(exchangeWarnings(createThorne(), spent)).toEqual([ACTION_SPENT_MESSAGES.action]);
  });

  it("хитов меньше курса — причина называет курс и наличное", () => {
    const bleeding = createThorne();
    bleeding.hitPoints = { ...bleeding.hitPoints, current: 2 };
    expect(exchangeWarnings(bleeding, ALL_TURN_RESOURCES)).toEqual([
      "3 хита за очко, в наличии 2",
    ]);
  });
});
