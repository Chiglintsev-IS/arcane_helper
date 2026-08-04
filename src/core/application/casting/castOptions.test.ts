import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import { ALL_TURN_RESOURCES } from "@/core/application/casting/availability";
import {
  bestCastPlan,
  castableWithinTurn,
  castOptions,
  slotPriceOf,
} from "@/core/application/casting/castOptions";

const allSpells = loadThorneSpells();

/**
 * Торн вне боя. Ритуальный способ существует только здесь: в бою он убран, потому что занимает на
 * 10 минут больше обычного, а начальный режим персонажа — «Бой».
 */
function outsideCombat(): CharacterState {
  return createThorne();
}

/** Идёт бой: счёт ходов ведётся. Раньше это следовало из режима экрана, теперь — из хода. */
const IN_COMBAT_TURN = { ...ALL_TURN_RESOURCES, inFight: true };

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

describe("castableWithinTurn", () => {
  it.each([
    ["shocking-grasp", true], // действие
    ["shield", true], // реакция
    ["mending", false], // 1 минута
    ["find-familiar", false], // 1 час
  ])("«%s» — %s", (id, expected) => {
    const spell = allSpells.find((candidate) => candidate.id === id);
    expect(spell, id).toBeDefined();
    expect(castableWithinTurn(spell!)).toBe(expected);
  });
});

describe("slotPriceOf: цена сотворения прямо сейчас", () => {
  it("цена — самый дешёвый способ прямо сейчас", () => {
    const detectMagic = allSpells.find((spell) => spell.id === "detect-magic")!;
    const shield = allSpells.find((spell) => spell.id === "shield")!;

    expect(slotPriceOf(detectMagic, false)).toBe(0);
    expect(slotPriceOf(detectMagic, true)).toBe(detectMagic.level);
    // Повышаемое стоит наименьший уровень: платить больше — выбор игрока, а не цена.
    expect(slotPriceOf(shield, true)).toBe(1);
  });
});
