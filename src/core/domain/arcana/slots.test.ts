import { DomainError } from "@/core/domain/shared/errors";
import { describe, expect, it } from "vitest";

import {
  applyArcaneRecovery,
  arcaneRecoveryBudget,
  arcaneRecoveryPlanCost,
  castableSlotLevels,
  consumesSlot,
  bloodSlotCost,
  bloodSlotLevels,
  recoverableSlots,
  refundSlot,
  restoreAllSlots,
  slotLevelPrice,
  spellSlotsForLevel,
  spendSlot,
  validateArcaneRecovery,
  type SlotRecoveryPlan,
  type SpellSlots,
} from "@/core/domain/arcana/slots";

const thorne = () => spellSlotsForLevel(7);

describe("spellSlotsForLevel", () => {
  it("даёт Торну 4 / 3 / 3 / 1", () => {
    expect(thorne()).toEqual({
      1: { maximum: 4, remaining: 4 },
      2: { maximum: 3, remaining: 3 },
      3: { maximum: 3, remaining: 3 },
      4: { maximum: 1, remaining: 1 },
    });
  });

  it.each([
    [1, [2]],
    [3, [4, 2]],
    [5, [4, 3, 2]],
    [11, [4, 3, 3, 3, 2, 1]],
    [20, [4, 3, 3, 3, 3, 2, 2, 1, 1]],
  ])("уровень %i соответствует таблице спеки", (level, expected) => {
    const slots = spellSlotsForLevel(level);
    expect(Object.keys(slots).map(Number)).toEqual(
      expected.map((_, index) => index + 1),
    );
    expect(expected.map((_, index) => slots[index + 1]?.maximum)).toEqual(expected);
  });

  it.each([0, 21, 2.5])("отклоняет недопустимый уровень %s", (level) => {
    expect(() => spellSlotsForLevel(level)).toThrow(DomainError);
  });
});

describe("consumesSlot", () => {
  it("заговор не расходует ячейку (FR-072)", () => {
    expect(consumesSlot(0, "cantrip")).toBe(false);
    expect(consumesSlot(0, "normal")).toBe(false);
  });

  it("ритуал не расходует ячейку (FR-073)", () => {
    expect(consumesSlot(1, "ritual")).toBe(false);
  });

  it("обычное применение расходует ячейку", () => {
    expect(consumesSlot(1, "normal")).toBe(true);
  });
});

describe("spendSlot и refundSlot", () => {
  it("списывает ячейку, не мутируя исходное состояние", () => {
    const before = thorne();
    const after = spendSlot(before, 2);
    expect(after[2]).toEqual({ maximum: 3, remaining: 2 });
    expect(before[2]).toEqual({ maximum: 3, remaining: 3 });
  });

  it("возвращает ошибочно потраченную ячейку", () => {
    expect(refundSlot(spendSlot(thorne(), 4), 4)).toEqual(thorne());
  });

  it("не даёт списать ячейку, которой нет в наличии", () => {
    const spent = spendSlot(thorne(), 4);
    expect(() => spendSlot(spent, 4)).toThrow(/Нет свободной ячейки 4 уровня/);
  });

  it("допускает уход в минус только по явному разрешению (FR-031)", () => {
    const spent = spendSlot(thorne(), 4);
    expect(spendSlot(spent, 4, { allowOverdraft: true })[4]).toEqual({
      maximum: 1,
      remaining: -1,
    });
  });

  it("не даёт вернуть больше, чем потрачено", () => {
    expect(() => refundSlot(thorne(), 1)).toThrow(/уже восстановлены полностью/);
  });

  it.each(["spend", "refund"] as const)("отклоняет уровень без ячеек в %s", (operation) => {
    const act = () =>
      operation === "spend" ? spendSlot(thorne(), 5) : refundSlot(thorne(), 5);
    expect(act).toThrow(/нет ячеек 5 уровня/);
  });

  it.each([0, 10])("отклоняет уровень ячейки %i", (level) => {
    expect(() => spendSlot(thorne(), level)).toThrow(DomainError);
  });

  it("симметричен: любая последовательность списаний и возвратов обратима", () => {
    const levels = [1, 2, 3, 4, 1, 2, 3, 1] as const;
    let slots: SpellSlots = thorne();
    for (const level of levels) slots = spendSlot(slots, level);
    for (const level of [...levels].reverse()) slots = refundSlot(slots, level);
    expect(slots).toEqual(thorne());
  });
});

describe("castableSlotLevels", () => {
  it("перечисляет уровни от собственного уровня заклинания и выше", () => {
    expect(castableSlotLevels(thorne(), 2)).toEqual([2, 3, 4]);
    expect(castableSlotLevels(thorne(), 4)).toEqual([4]);
  });

  it("для заговора не предлагает ячеек", () => {
    expect(castableSlotLevels(thorne(), 0)).toEqual([]);
  });
});

describe("восстановление ресурсов", () => {
  it("долгий отдых возвращает все ячейки (FR-130)", () => {
    let slots = spendSlot(thorne(), 1);
    slots = spendSlot(slots, 4);
    expect(restoreAllSlots(slots)).toEqual(thorne());
  });

  it("бюджет магического восстановления Торна равен 4", () => {
    expect(arcaneRecoveryBudget(7)).toBe(4);
  });

  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [7, 4],
    [20, 10],
  ])("бюджет на уровне %i равен %i", (level, expected) => {
    expect(arcaneRecoveryBudget(level)).toBe(expected);
  });

  it("отклоняет недопустимый уровень", () => {
    expect(() => arcaneRecoveryBudget(0)).toThrow(DomainError);
  });
});

describe("validateArcaneRecovery", () => {
  const depleted = (): SpellSlots => ({
    1: { maximum: 4, remaining: 0 },
    2: { maximum: 3, remaining: 0 },
    3: { maximum: 3, remaining: 0 },
    4: { maximum: 1, remaining: 1 },
  });

  const depletedIncludingFourth = (): SpellSlots => ({
    ...depleted(),
    4: { maximum: 1, remaining: 0 },
  });

  const validPlans: ReadonlyArray<readonly [SlotRecoveryPlan, string]> = [
    [{ 4: 1 }, "одна ячейка 4 уровня"],
    [{ 3: 1, 1: 1 }, "ячейки 3 + 1"],
    [{ 2: 2 }, "две ячейки 2 уровня"],
    [{ 2: 1, 1: 2 }, "ячейки 2 + 1 + 1"],
    [{ 1: 4 }, "четыре ячейки 1 уровня"],
  ];

  it.each(validPlans)("принимает план: %s", (plan, description) => {
    expect(validateArcaneRecovery(depletedIncludingFourth(), plan, 4), description).toEqual({
      valid: true,
    });
  });

  it("отклоняет превышение остатка бюджета", () => {
    const result = validateArcaneRecovery(depleted(), { 3: 1, 2: 1 }, 4);
    expect(result).toEqual({
      valid: false,
      reason: expect.stringContaining("превышает остаток бюджета 4"),
    });
  });

  it("отклоняет план, не укладывающийся в частично потраченный остаток", () => {
    const result = validateArcaneRecovery(depleted(), { 3: 1 }, 2);
    expect(result).toEqual({
      valid: false,
      reason: expect.stringContaining("превышает остаток бюджета 2"),
    });
  });

  it("отклоняет ячейку выше пятого уровня", () => {
    const slots: SpellSlots = { 6: { maximum: 1, remaining: 0 } };
    const result = validateArcaneRecovery(slots, { 6: 1 }, 10);
    expect(result).toEqual({ valid: false, reason: expect.stringContaining("выше 5 уровня") });
  });

  it("отклоняет возврат сверх максимума по уровню", () => {
    const result = validateArcaneRecovery(depleted(), { 1: 4, 2: 0 }, 10);
    expect(result).toEqual({ valid: true });
    const excessive = validateArcaneRecovery(depleted(), { 1: 5 }, 10);
    expect(excessive).toEqual({
      valid: false,
      reason: expect.stringContaining("больше, чем потрачено"),
    });
  });

  it("отклоняет уровень, которого у персонажа нет", () => {
    const result = validateArcaneRecovery(depleted(), { 5: 1 }, 10);
    expect(result).toEqual({ valid: false, reason: expect.stringContaining("нет ячеек 5 уровня") });
  });

  it("отклоняет пустой план", () => {
    expect(validateArcaneRecovery(depleted(), {}, 4)).toEqual({
      valid: false,
      reason: "План восстановления пуст",
    });
    expect(validateArcaneRecovery(depleted(), { 1: 0 }, 4)).toEqual({
      valid: false,
      reason: "План восстановления пуст",
    });
  });

  it("отклоняет нецелое и отрицательное количество", () => {
    expect(validateArcaneRecovery(depleted(), { 1: -1 }, 4).valid).toBe(false);
    expect(validateArcaneRecovery(depleted(), { 1: 1.5 }, 4).valid).toBe(false);
  });
});

describe("arcaneRecoveryPlanCost", () => {
  it("складывает уровень, умноженный на количество", () => {
    expect(arcaneRecoveryPlanCost({ 1: 2, 3: 1 })).toBe(5);
  });

  it("пустой план стоит ноль", () => {
    expect(arcaneRecoveryPlanCost({})).toBe(0);
  });
});

describe("applyArcaneRecovery", () => {
  const depleted = (): SpellSlots => ({
    1: { maximum: 4, remaining: 0 },
    2: { maximum: 3, remaining: 0 },
    3: { maximum: 3, remaining: 1 },
    4: { maximum: 1, remaining: 1 },
  });

  it("возвращает выбранные ячейки", () => {
    expect(applyArcaneRecovery(depleted(), { 3: 1, 1: 1 }, 4)).toEqual({
      1: { maximum: 4, remaining: 1 },
      2: { maximum: 3, remaining: 0 },
      3: { maximum: 3, remaining: 2 },
      4: { maximum: 1, remaining: 1 },
    });
  });

  it("не мутирует исходное состояние", () => {
    const before = depleted();
    applyArcaneRecovery(before, { 1: 2 }, 4);
    expect(before[1]).toEqual({ maximum: 4, remaining: 0 });
  });

  it("отклоняет некорректный план целиком, а не частично", () => {
    expect(() => applyArcaneRecovery(depleted(), { 3: 2 }, 4)).toThrow(DomainError);
  });

  it("игнорирует нулевые позиции плана", () => {
    expect(applyArcaneRecovery(depleted(), { 1: 1, 2: 0 }, 4)[2]).toEqual({
      maximum: 3,
      remaining: 0,
    });
  });
});

describe("курс ступени возвышения", () => {
  it.each([
    [1, 2],
    [4, 2],
    [5, 3],
    [8, 3],
    [12, 4],
    [16, 5],
    [20, 6],
  ])("на %i уровне единица цены стоит %i хитов", (level, expected) => {
    expect(bloodSlotCost(1, level)).toBe(expected * 2);
  });

  it.each([0, 21, 2.5])("отклоняет уровень персонажа %s", (level) => {
    expect(() => bloodSlotCost(1, level)).toThrow(DomainError);
  });
});

describe("slotLevelPrice", () => {
  it.each([
    [1, 2],
    [2, 3],
    [3, 5],
    [4, 6],
    [5, 7],
  ])("ячейка %i уровня стоит %i единиц цены", (castLevel, expected) => {
    expect(slotLevelPrice(castLevel)).toBe(expected);
  });

  it.each([0, 6, 9])("отклоняет уровень %i: цены у него нет", (castLevel) => {
    expect(() => slotLevelPrice(castLevel)).toThrow(DomainError);
  });
});

describe("bloodSlotCost", () => {
  it.each([
    [1, 6],
    [2, 9],
    [3, 15],
    [4, 18],
    [5, 21],
  ])("ячейка %i уровня стоит %i хитов на ступени Торна", (castLevel, expected) => {
    expect(bloodSlotCost(castLevel, 7)).toBe(expected);
  });

  it("на первой ступени та же ячейка дешевле, на последней дороже", () => {
    expect(bloodSlotCost(1, 3)).toBe(4);
    expect(bloodSlotCost(4, 20)).toBe(36);
  });
});

describe("bloodSlotLevels", () => {
  const thorne = spellSlotsForLevel(7);

  it.each([
    [1, [1, 2, 3, 4]],
    [3, [3, 4]],
    [4, [4]],
    [5, []],
  ])("кровь повторяет уровни пула, а не превосходит их: %i → %j", (spellLevel, expected) => {
    expect(bloodSlotLevels(thorne, spellLevel)).toEqual(expected);
  });

  it("заговору ячейка не нужна, и кровь её не создаёт", () => {
    expect(bloodSlotLevels(thorne, 0)).toEqual([]);
  });

  it("выше пятого уровня цены нет, сколько бы ячеек ни было у персонажа", () => {
    expect(bloodSlotLevels(spellSlotsForLevel(17), 4)).toEqual([4, 5]);
  });
});

describe("recoverableSlots", () => {
  it("берёт только потраченные и от младших к старшим", () => {
    const slots = {
      1: { maximum: 4, remaining: 4 },
      2: { maximum: 3, remaining: 1 },
      3: { maximum: 3, remaining: 0 },
    };
    expect(recoverableSlots(slots).map((slot) => slot.level)).toEqual([2, 3]);
  });

  it("выше своего предела уровня не берёт: восстановление их не возвращает", () => {
    const slots = {
      5: { maximum: 1, remaining: 0 },
      6: { maximum: 1, remaining: 0 },
    };
    expect(recoverableSlots(slots).map((slot) => slot.level)).toEqual([5]);
  });

  it("целым ячейкам возвращать нечего", () => {
    expect(recoverableSlots(thorne())).toEqual([]);
  });
});
