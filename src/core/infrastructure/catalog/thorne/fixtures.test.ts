import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import {
  withBloodExchange,
  withBloodSpent,
  withDamage,
  withForeignSlots,
  withMasterReduction,
  withSpellPoints,
  withSpellPointsSpent,
  withSpentHitDice,
  withSpentSlots,
  withoutArcaneRecovery,
  withoutHitDice,
  withoutRunes,
  withoutSlots,
} from "@/core/infrastructure/catalog/thorne/fixtures";

/**
 * Состояния для прогонов проверяются сами: фикстура, обещающая одно и делающая другое, ломает не
 * себя, а тот прогон, который ей поверил, — и разбираться начинают не с неё.
 */
describe("состояния Торна операциями", () => {
  it("истраченные ячейки уходят из остатка, а максимум остаётся", () => {
    const spent = withSpentSlots(createThorne(), 1, 3);
    expect(spent.spellSlots[1]).toEqual({ maximum: 4, remaining: 1 });
  });

  it("без свободных ячеек не остаётся ни одного уровня", () => {
    const spent = withoutSlots(createThorne());
    expect(Object.values(spent.spellSlots).every((slot) => slot.remaining === 0)).toBe(true);
  });

  it("урон снижает текущие хиты, максимум не трогая", () => {
    const wounded = withDamage(createThorne(), 48);
    expect(wounded.hitPoints.current).toBe(12);
    expect(wounded.hitPoints.maximumBase).toBe(60);
  });

  it("обмен кровью платит и текущими, и максимумом, и даёт очки", () => {
    const exchanged = withBloodExchange(createThorne(), 3);
    expect(exchanged.hitPoints).toEqual({
      current: 51,
      maximumBase: 60,
      bloodReduction: 9,
      masterReduction: 0,
    });
    expect(exchanged.spellPoints.remaining).toBe(3);
  });

  it("израсходованные очки не оставляют запаса, снижение остаётся", () => {
    const spent = withBloodSpent(createThorne(), 3);
    expect(spent.spellPoints.remaining).toBe(0);
    expect(spent.hitPoints.bloodReduction).toBe(9);
  });

  it("очки появляются запасом и тратятся по цене уровня", () => {
    const rich = withSpellPoints(createThorne(), 6);
    expect(rich.spellPoints.remaining).toBe(6);
    expect(withSpellPointsSpent(rich, 1).spellPoints.remaining).toBe(4);
  });

  it("снижение мастера опускает действующий максимум вместе с текущими", () => {
    const weakened = withMasterReduction(createThorne(), 10);
    expect(weakened.hitPoints.masterReduction).toBe(10);
    expect(weakened.hitPoints.current).toBe(50);
  });

  it("руны кончаются все", () => {
    expect(withoutRunes(createThorne()).runes.remaining).toBe(0);
  });

  it("кости хитов тратятся по счёту и до нуля", () => {
    expect(withSpentHitDice(createThorne(), 5).hitDice?.remaining).toBe(2);
    expect(withoutHitDice(createThorne()).hitDice?.remaining).toBe(0);
  });

  it("состоянию без костей тратить нечего", () => {
    const { hitDice: _none, ...withoutPool } = createThorne();
    expect(withoutHitDice(withoutPool as ReturnType<typeof createThorne>).hitDice).toBeUndefined();
  });

  it("бюджет восстановления кончается, а ячейки при этом целы", () => {
    const exhausted = withoutArcaneRecovery(createThorne());
    expect(exhausted.arcaneRecovery.remaining).toBe(0);
    expect(exhausted.spellSlots[1]?.remaining).toBe(4);
    // Уже исчерпанный бюджет второй раз тратить нечем.
    expect(withoutArcaneRecovery(exhausted).arcaneRecovery.remaining).toBe(0);
  });

  it("чужие ячейки принимаются как есть: игра таких состояний не создаёт", () => {
    expect(withForeignSlots(createThorne(), {}).spellSlots).toEqual({});
  });
});
