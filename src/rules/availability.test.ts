import { describe, expect, it } from "vitest";

import { createThorne } from "@/data/content/thorne/character";
import { loadThorneSpells } from "@/data/content/thorne";
import type { CharacterState } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";
import {
  ALL_TURN_RESOURCES,
  checkAvailability,
  reasonsOf,
  type AvailabilityInput,
} from "./availability";

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

function check(overrides: Partial<AvailabilityInput> & { spell: Spell }) {
  const input: AvailabilityInput = {
    character: createThorne(),
    turn: ALL_TURN_RESOURCES,
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
      turn: { actionAvailable: false, bonusActionAvailable: false, reactionAvailable: false },
    });
    expect(availability.warnings).toEqual([]);
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
    character.spellPoints = { remaining: 3, createdAt: "2026-07-31T18:00:00.000Z" };
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
        type: "control",
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
    expect(warning?.overridable).toBe(false);
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
    expect(reminders).toContain(
      "Компонент: жемчужина стоимостью не менее 100 зм и перо совы — 100 зм, фокусировка не заменяет",
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
      turn: { ...ALL_TURN_RESOURCES, actionAvailable: false },
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
      turn: { ...ALL_TURN_RESOURCES, actionAvailable: false },
    });
    expect(availability.overridable).toBe(true);
  });
});
