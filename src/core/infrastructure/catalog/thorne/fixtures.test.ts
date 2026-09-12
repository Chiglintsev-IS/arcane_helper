import { describe, expect, it } from "vitest";

import {
  createWizard,
  knowing,
  withBloodPaid,
  withDamage,
  withForeignSlots,
  withMasterReduction,
  withSpentHitDice,
  withSpentSlots,
  withoutArcaneRecovery,
  withoutHitDice,
  withoutRunes,
  withoutSlots,
} from "@/core/infrastructure/catalog/thorne/fixtures";

describe("состояния Торна операциями", () => {
  it("истраченные ячейки уходят из остатка, а максимум остаётся", () => {
    const spent = withSpentSlots(createWizard(), 1, 3);
    expect(spent.spellSlots[1]).toEqual({ maximum: 4, remaining: 1 });
  });

  it("без свободных ячеек не остаётся ни одного уровня", () => {
    const spent = withoutSlots(createWizard());
    expect(Object.values(spent.spellSlots).every((slot) => slot.remaining === 0)).toBe(true);
  });

  it("урон снижает текущие хиты, максимум не трогая", () => {
    const wounded = withDamage(createWizard(), 48);
    expect(wounded.hitPoints.current).toBe(12);
    expect(wounded.hitPoints.maximumBase).toBe(60);
  });

  it("плата кровью снимает и текущие хиты, и максимум", () => {
    const paid = withBloodPaid(createWizard(), 2);
    expect(paid.hitPoints).toEqual({
      current: 51,
      maximumBase: 60,
      bloodReduction: 9,
      masterReduction: 0,
    });
  });

  it("снижение мастера опускает действующий максимум вместе с текущими", () => {
    const weakened = withMasterReduction(createWizard(), 10);
    expect(weakened.hitPoints.masterReduction).toBe(10);
    expect(weakened.hitPoints.current).toBe(50);
  });

  it("руны кончаются все", () => {
    expect(withoutRunes(createWizard()).runes.remaining).toBe(0);
  });

  it("кости хитов тратятся по счёту и до нуля", () => {
    expect(withSpentHitDice(createWizard(), 5).hitDice?.remaining).toBe(2);
    expect(withoutHitDice(createWizard()).hitDice?.remaining).toBe(0);
  });

  it("состоянию без костей тратить нечего", () => {
    const { hitDice: _none, ...withoutPool } = createWizard();
    expect(withoutHitDice(withoutPool).hitDice).toBeUndefined();
  });

  it("бюджет восстановления кончается, а ячейки при этом целы", () => {
    const exhausted = withoutArcaneRecovery(createWizard());
    expect(exhausted.arcaneRecovery.remaining).toBe(0);
    expect(exhausted.spellSlots[1]?.remaining).toBe(4);
    expect(withoutArcaneRecovery(exhausted).arcaneRecovery.remaining).toBe(0);
  });

  it("чужие ячейки принимаются как есть: игра таких состояний не создаёт", () => {
    expect(withForeignSlots(createWizard(), {}).spellSlots).toEqual({});
  });

  it("знание отложенного дописывает книгу, а знакомое второй записи не заводит", () => {
    const known = knowing(createWizard(), "fireball");
    expect(known.spellbookSpellIds).toContain("fireball");
    expect(knowing(known, "fireball")).toBe(known);
    expect(knowing(createWizard(), "shield").spellbookSpellIds).toEqual(
      createWizard().spellbookSpellIds,
    );
  });
});
