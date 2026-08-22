import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import { ALL_TURN_RESOURCES } from "@/core/application/casting/availability";
import { withForeignSlots, withSpentSlots } from "@/core/infrastructure/catalog/thorne/fixtures";
import {
  castPlans,
  castableInSituation,
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

function plansOf(...args: Parameters<typeof castPlans>) {
  const found = castPlans(...args);
  if (found === null) throw new Error("способов нет вовсе");
  return found;
}

function optionsOf(...args: Parameters<typeof castPlans>) {
  return plansOf(...args).all.map((plan) => plan.option);
}

describe("castPlans: какие способы вообще есть", () => {
  it("для заговора предлагает единственный способ — без оплаты", () => {
    const rayOfFrost = allSpells.find((spell) => spell.id === "ray-of-frost")!;
    expect(optionsOf(rayOfFrost, createThorne(), IN_COMBAT_TURN)).toEqual([
      { mode: "cantrip", payment: { kind: "none" } },
    ]);
  });

  it("для заклинания перечисляет ячейки от своего уровня и выше", () => {
    const mageArmor = allSpells.find((spell) => spell.id === "mage-armor")!;
    expect(optionsOf(mageArmor, createThorne(), IN_COMBAT_TURN)).toEqual([
      { mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
      { mode: "normal", payment: { kind: "slot", slotLevel: 2 } },
      { mode: "normal", payment: { kind: "slot", slotLevel: 3 } },
      { mode: "normal", payment: { kind: "slot", slotLevel: 4 } },
      { mode: "normal", payment: { kind: "blood", castLevel: 1 } },
      { mode: "normal", payment: { kind: "blood", castLevel: 2 } },
      { mode: "normal", payment: { kind: "blood", castLevel: 3 } },
      { mode: "normal", payment: { kind: "blood", castLevel: 4 } },
    ]);
  });

  it("оплата кровью повышает уровень сотворения", () => {
    const mageArmor = allSpells.find((spell) => spell.id === "mage-armor")!;
    const bloodLevels = optionsOf(mageArmor, createThorne(), IN_COMBAT_TURN)
      .filter((option) => option.payment.kind === "blood")
      .map((option) => (option.payment.kind === "blood" ? option.payment.castLevel : 0));
    // Те же уровни, что и у ячеек пула: выше своей таблицы кровь не поднимает.
    expect(bloodLevels).toEqual([1, 2, 3, 4]);
  });

  it("не предлагает оплату кровью там, где её цена неизвестна", () => {
    const mageArmor = allSpells.find((spell) => spell.id === "mage-armor")!;
    const sixthLevel = { ...mageArmor, level: 6 };
    // Ячейка шестого уровня Торну недоступна: состояние пришло чужой выгрузкой.
    const character = withForeignSlots(createThorne(), {
      ...createThorne().spellSlots,
      6: { maximum: 1, remaining: 1 },
    });

    expect(optionsOf(sixthLevel, character, IN_COMBAT_TURN)).toEqual([
      { mode: "normal", payment: { kind: "slot", slotLevel: 6 } },
    ]);
  });

  it("для ритуального заклинания добавляет ритуальный режим", () => {
    const identify = allSpells.find((spell) => spell.id === "identify")!;
    expect(optionsOf(identify, outsideCombat(), ALL_TURN_RESOURCES)).toContainEqual({
      mode: "ritual",
      payment: { kind: "none" },
    });
  });

  it("в бою ритуального способа нет: +10 минут в раунд не помещаются (FR-208)", () => {
    const detectMagic = allSpells.find((spell) => spell.id === "detect-magic")!;
    const inCombat = optionsOf(detectMagic, createThorne(), IN_COMBAT_TURN);

    expect(inCombat).not.toContainEqual({ mode: "ritual", payment: { kind: "none" } });
    // Ячейкой заклинание при этом остаётся доступно: убран способ, а не заклинание.
    expect(inCombat).toContainEqual({ mode: "normal", payment: { kind: "slot", slotLevel: 1 } });
  });

  it("проверяет каждый способ, а не только предложенный", () => {
    const mageArmor = allSpells.find((spell) => spell.id === "mage-armor")!;
    // Ячейки первого уровня истрачены: способ остаётся в списке, но со своей причиной отказа.
    const spent = withSpentSlots(createThorne(), 1, 4);

    const plans = plansOf(mageArmor, spent, IN_COMBAT_TURN).all;
    const first = plans.find(
      (plan) => plan.option.payment.kind === "slot" && plan.option.payment.slotLevel === 1,
    );
    const second = plans.find(
      (plan) => plan.option.payment.kind === "slot" && plan.option.payment.slotLevel === 2,
    );

    expect(first?.availability.available).toBe(false);
    expect(second?.availability.available).toBe(true);
  });
});

describe("castPlans: какой способ предложен", () => {
  const detectMagic = allSpells.find((spell) => spell.id === "detect-magic")!;
  const mageArmor = allSpells.find((spell) => spell.id === "mage-armor")!;

  it("для неподготовленного ритуала выбирает ритуал, а не ячейку (FR-103)", () => {
    const plan = plansOf(detectMagic, outsideCombat(), ALL_TURN_RESOURCES).suggested;

    expect(plan.option).toEqual({ mode: "ritual", payment: { kind: "none" } });
    expect(plan.availability.available).toBe(true);
  });

  it("в бою тот же ритуал разрешается ячейкой (FR-208)", () => {
    // Способ, которого нет, не может оказаться лучшим: в бою остаётся оплата ячейкой, и она же
    // объясняет доступность.
    const plan = plansOf(detectMagic, createThorne(), IN_COMBAT_TURN).suggested;

    expect(plan.option).toEqual({ mode: "normal", payment: { kind: "slot", slotLevel: 1 } });
  });

  it("объясняет недоступность причиной лучшего способа, а не первого попавшегося", () => {
    // Ритуалу подготовка не нужна, поэтому мешает ему только занятая концентрация. Причина
    // «не подготовлено» пришла бы от ячейки — способа, которым это заклинание и не творят.
    const character = {
      ...outsideCombat(),
      concentration: { spellId: "web", startedAt: "2026-07-31T18:00:00.000Z" },
    };

    const plan = plansOf(detectMagic, character, ALL_TURN_RESOURCES).suggested;

    expect(plan.availability.warnings.map((warning) => warning.code)).toEqual([
      "concentration_busy",
    ]);
  });

  it("без способов сотворения отвечать нечем", () => {
    const character = withForeignSlots(createThorne(), {});
    const sixthLevel = { ...mageArmor, level: 6 };

    expect(castPlans(sixthLevel, character, ALL_TURN_RESOURCES)).toBeNull();
  });
});

describe("в бою творится только то, что укладывается в ход", () => {
  it.each([
    ["shocking-grasp", true], // действие
    ["shield", true], // реакция
    ["mending", false], // 1 минута
    ["find-familiar", false], // 1 час
  ])("«%s» — %s", (id, expected) => {
    const spell = allSpells.find((candidate) => candidate.id === id);
    expect(spell, id).toBeDefined();
    expect(castableInSituation(spell!, createThorne(), true)).toBe(expected);
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
