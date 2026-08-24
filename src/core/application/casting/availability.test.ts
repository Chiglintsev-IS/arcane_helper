import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { withDamage, withSpentSlots } from "@/core/infrastructure/catalog/thorne/fixtures";
import { withoutSpellcastingFocus } from "@/core/infrastructure/catalog/thorne/fixtures";
import { Character } from "@/core/domain/assembly/character";
import {
  ALL_TURN_RESOURCES,
  checkAvailability,
  componentRequirements,
  withoutConsent,
  type Availability,
} from "@/core/application/casting/availability";
import { materialCoveredByFocus, materialOf } from "@/core/application/casting/material";

/** Вход проверки и одно её предупреждение: формы называет подпись, отдельных имён им не нужно. */
type AvailabilityInput = Parameters<typeof checkAvailability>[0];
type AvailabilityWarning = Availability["warnings"][number];

/** Причины одного кода: проверка возвращает все предупреждения, а прогон спрашивает про одно. */
function reasonsOf(availability: Availability, code: AvailabilityWarning["code"]): string[] {
  return availability.warnings
    .filter((warning) => warning.code === code)
    .map((warning) => warning.reasonRu);
}

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
      spell: findFamiliar,
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
  /** Ячейки этого уровня истрачены: тратит их то же правило, что за столом. */
  function withoutSlots(level: number): CharacterState {
    const character = createThorne();
    const slot = character.spellSlots[level];
    if (slot === undefined) throw new Error(`нет ячеек ${level} уровня`);
    return withSpentSlots(character, level, slot.remaining);
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

  it("здоровому кровь создаёт ячейку без помех", () => {
    const availability = check({
      spell: mageArmor,
      payment: { kind: "blood", castLevel: 1 },
    });
    expect(availability).toEqual({ available: true, warnings: [] });
  });

  it("ячейка старшего уровня кровью тоже доступна", () => {
    const availability = check({ spell: mageArmor, payment: { kind: "blood", castLevel: 4 } });
    expect(availability.available).toBe(true);
  });

  it("уровня, до которого персонаж не дорос, кровь не создаёт", () => {
    const availability = check({ spell: mageArmor, payment: { kind: "blood", castLevel: 5 } });
    expect(reasonsOf(availability, "no_slot")).toEqual(["Ячеек 5 уровня у персонажа нет"]);
  });

  it("ячейкой ниже уровня заклинания кровь не поможет", () => {
    const secondLevel: Spell = { ...mageArmor, level: 2 };
    const availability = check({
      spell: secondLevel,
      payment: { kind: "blood", castLevel: 1 },
    });
    expect(reasonsOf(availability, "cast_level_too_low")).toEqual([
      "Ячейкой 1 уровня заклинание 2 уровня не сотворить",
    ]);
  });

  it("подавленной кровью ячейку не создать, и причина та же", () => {
    const sunlit = {
      ...createThorne(),
      suppression: { firedUponTurnStarts: 0, underDirectSunlight: true },
    };
    const availability = check({
      spell: mageArmor,
      character: sunlit,
      payment: { kind: "blood", castLevel: 1 },
    });
    expect(reasonsOf(availability, "blood_suppressed")).toEqual([
      "Кровавое колдовство не действует под прямым солнечным светом",
    ]);
  });

  it("хитов на ячейку не хватает — отказ до разрешения мастера", () => {
    const bleeding = withDamage(createThorne(), 58);
    const { warnings } = check({
      spell: mageArmor,
      character: bleeding,
      payment: { kind: "blood", castLevel: 1 },
    });
    expect(withoutConsent(warnings, {})?.code).toBe("not_enough_hit_points");
  });

  it("плата до нуля предупреждает о ранах, но не запрещает", () => {
    const bleeding = withDamage(createThorne(), 54);
    const availability = check({
      spell: mageArmor,
      character: bleeding,
      payment: { kind: "blood", castLevel: 1 },
    });
    expect(reasonsOf(availability, "wounds_from_blood")).toEqual([
      "Хиты уйдут в ноль: 1 рана за сам факт и ещё по 1 за каждые три единицы цены — итого 1 рана",
    ]);
    expect(withoutConsent(availability.warnings, {})).toBeUndefined();
  });

  it("заговор с выбранной ячейкой — ошибка данных, а не предупреждение", () => {
    expect(() =>
      check({ spell: rayOfFrost, payment: { kind: "slot", slotLevel: 1 } }),
    ).toThrow(/не расходует ячейку/);
  });

  it("ритуал с выбранной ячейкой — ошибка данных, а не предупреждение", () => {
    expect(() =>
      check({ spell: findFamiliar, mode: "ritual", payment: { kind: "slot", slotLevel: 1 } }),
    ).toThrow(/Ритуальное применение не расходует ячейку/);
  });

  it("заклинание без способа оплаты предупреждает, а не молчит", () => {
    const availability = check({ spell: mageArmor, payment: { kind: "none" } });
    expect(reasonsOf(availability, "no_payment")).toEqual([
      "Не выбран способ оплаты: ячейка или кровь",
    ]);
  });
});

describe("checkAvailability: концентрация (FR-030, FR-081)", () => {
  function concentrating(): CharacterState {
    return {
      ...createThorne(),
      concentration: { spellId: "detect-magic", startedAt: "2026-07-31T18:00:00.000Z" },
      activeEffects: [
        {
          id: "effect-1",
          spellId: "detect-magic",
          nameRu: "Обнаружение магии",
          startedAt: "2026-07-31T18:00:00.000Z",
          duration: { type: "minutes", value: 10 },
          isConcentration: true,
          slotLevelUsed: 1,
          contributions: [],
          endConditionRu: "До конца концентрации или истечения длительности.",
        },
      ],
    };
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
    const broken = {
      ...concentrating(),
      activeEffects: [],
    };
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

describe("перечень требований (FR-030)", () => {
  const requirements = (target: Spell, character: CharacterState = createThorne()) =>
    componentRequirements(target.components, materialCoveredByFocus(target.components, character));

  it("перечисляет действия словами, а не аббревиатурой «В, С, М»", () => {
    // Фокусировки нет, поэтому кожа «Доспехов мага» названа: закрытая, она молчала бы.
    expect(requirements(mageArmor, withoutSpellcastingFocus(createThorne()))).toEqual([
      "Произнести вслух",
      "Жест свободной рукой",
      "Компонент: кусок обработанной кожи",
    ]);
  });

  it("предупреждает, что фокусировка не заменяет компонент со стоимостью", () => {
    // Компонента «стоит денег, но не расходуется» в книге сейчас нет, поэтому цену и расход
    // свидетельствует одна карточка: здесь проверяется цена, следующим тестом — расход.
    expect(requirements(findFamiliar).at(-1)).toContain("10 зм, фокусировка не заменяет");
  });

  it("отмечает расходуемый компонент", () => {
    expect(requirements(findFamiliar).at(-1)).toMatch(/расходуется/);
  });

  it("заклинание без компонентов напоминаний не порождает", () => {
    const silent: Spell = {
      ...mageArmor,
      components: { verbal: false, somatic: false, material: false },
    };
    expect(requirements(silent)).toEqual([]);
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
  /** Компонент куплен и лежит в сумке: он вещь и попадает туда как всякая вещь. */
  function withMaterialInBag(character: CharacterState, forSpell: Spell): CharacterState {
    const material = materialOf(forSpell.components);
    if (material === undefined) throw new Error(`«${forSpell.nameRu}» материала не требует`);
    const root = Character.of(character);
    return root
      .withItems(root.items.addDefinition(material))
      .withEquipment(root.equipment.adjustBagCount(material.id, 1))
      .toState();
  }

  const missingComponent = (target: Spell, character: CharacterState = createThorne()) =>
    check({ spell: target, character }).warnings.find(
      (warning) => warning.code === "no_component",
    );

  it("дорогой компонент проверяется запасом в сумке (FR-268)", () => {
    const missing = missingComponent(findFamiliar);
    expect(missing?.reasonRu).toContain("уголь, благовония и травы");
    // Проходимо: мастер вправе разрешить, а игрок — вспомнить, что запас всё-таки есть.
    expect(missing?.enforcement).toBe("advisory");

    expect(
      missingComponent(findFamiliar, withMaterialInBag(createThorne(), findFamiliar)),
    ).toBeUndefined();
  });

  it("закрытый фокусировкой компонент не проверяется и требованием не называется (FR-268)", () => {
    const covered = mageArmor.components;
    expect(missingComponent(mageArmor)).toBeUndefined();
    expect(componentRequirements(covered, materialCoveredByFocus(covered, createThorne()))).toEqual([
      "Произнести вслух",
      "Жест свободной рукой",
    ]);
  });

  it("без фокусировки и мешочка компонент спрашивают у сумки", () => {
    const empty = withoutSpellcastingFocus(createThorne());

    expect(missingComponent(mageArmor, empty)?.reasonRu).toContain("кусок обработанной кожи");
    expect(missingComponent(mageArmor, withMaterialInBag(empty, mageArmor))).toBeUndefined();
  });

  it("состоянию без записи о снаряжении вердикта не выдумывает", () => {
    const base = createThorne();
    const { components: _none, ...withoutComponents } = base.equipment;

    expect(missingComponent(findFamiliar, { ...base, equipment: withoutComponents })).toBeUndefined();
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

