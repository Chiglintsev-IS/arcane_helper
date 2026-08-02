import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import { Vitality } from "@/core/domain/vitality/vitality";

describe("снижение максимума мастером", () => {
  const base = () => ({
    hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
    temporaryHitPoints: 0,
    hitDice: { total: 7, size: 6, remaining: 7 },
    suppression: { firedUpon: false, underDirectSunlight: false },
  });

  it("действующий максимум вычитает оба снижения", () => {
    const vitality = Vitality.of({
      ...base(),
      hitPoints: { current: 40, maximumBase: 60, bloodReduction: 9, masterReduction: 10 },
    });
    expect(vitality.maximum).toBe(41);
  });

  it("час возвращает кровавое снижение и не трогает мастерское", () => {
    const vitality = Vitality.of({
      ...base(),
      hitPoints: { current: 10, maximumBase: 60, bloodReduction: 9, masterReduction: 10 },
    });
    const after = vitality.afterAnHour(7).vitality.toState();
    expect(after.hitPoints.masterReduction).toBe(10);
    expect(after.hitPoints.bloodReduction).toBeLessThan(9);
  });

  it("лечение упирается в действующий максимум", () => {
    const vitality = Vitality.of({
      ...base(),
      hitPoints: { current: 40, maximumBase: 60, bloodReduction: 0, masterReduction: 10 },
    });
    expect(vitality.heal(100).vitality.toState().hitPoints.current).toBe(50);
  });

  it("снижение мастера ставится и снимается", () => {
    const set = Vitality.of(base()).withMasterReduction(12);
    expect(set.maximum).toBe(48);
    expect(set.withMasterReduction(0).maximum).toBe(60);
  });

  it("текущие хиты обрезаются новым максимумом", () => {
    expect(Vitality.of(base()).withMasterReduction(20).toState().hitPoints.current).toBe(40);
  });

  it("правка базы двигает максимум и обрезает текущее", () => {
    const shrunk = Vitality.of(base()).withMaximumBase(30);
    expect(shrunk.maximum).toBe(30);
    expect(shrunk.toState().hitPoints.current).toBe(30);
    expect(Vitality.of(base()).withMaximumBase(80).maximum).toBe(80);
  });

  it("состояние без костей хитов смену уровня переживает", () => {
    const { hitDice: _none, ...withoutDice } = base();
    expect(Vitality.of(withoutDice).resizedHitDice(8).toState().hitDice).toBeUndefined();
  });

  it("отвергает нецелые и отрицательные значения", () => {
    expect(() => Vitality.of(base()).withMaximumBase(0)).toThrow(DomainError);
    expect(() => Vitality.of(base()).withMaximumBase(1.5)).toThrow(DomainError);
    expect(() => Vitality.of(base()).withMasterReduction(-1)).toThrow(DomainError);
    expect(() => Vitality.of(base()).withMasterReduction(1.5)).toThrow(DomainError);
  });
});
