import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import { Vitality } from "@/core/domain/vitality/vitality";

describe("снижение максимума мастером", () => {
  const base = () => ({
    hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
    temporaryHitPoints: 0,
    hitDice: { total: 7, size: 6, remaining: 7 },
    suppression: { firedUponTurnStarts: 0, underDirectSunlight: false },
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

describe("порог регенерации", () => {
  const healthy = () =>
    Vitality.of({
      hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
      temporaryHitPoints: 0,
      hitDice: { total: 7, size: 6, remaining: 7 },
      suppression: { firedUponTurnStarts: 0, underDirectSunlight: false },
    });

  it("непрерывная регенерация меряет тот же действующий максимум, что и ход", () => {
    const bled = healthy().payWithBlood(9).withMasterReduction(9);
    const wounded = bled.takeDamage(20).vitality;
    expect(wounded.maximum).toBe(42);

    expect(wounded.current).toBe(22);
    expect(wounded.regenerationDue(7)).toBe(0);
    expect(wounded.continuousRegenerationDue()).toBe(0);

    const lower = wounded.takeDamage(2).vitality;
    expect(lower.regenerationDue(7)).toBeGreaterThan(0);
    expect(lower.regeneratedContinuously().vitality.current).toBe(21);
  });

  it("подавление и ноль хитов выключают непрерывную регенерацию", () => {
    const wounded = healthy().takeDamage(50).vitality;
    expect(wounded.continuousRegenerationDue()).toBeGreaterThan(0);

    expect(wounded.setSunlight(true).continuousRegenerationDue()).toBe(0);
    expect(wounded.takeDamage(1, { fire: true }).vitality.continuousRegenerationDue()).toBe(0);
    expect(wounded.takeDamage(10).vitality.continuousRegenerationDue()).toBe(0);
  });

  it("с первого же вернувшегося хита регенерация идёт снова", () => {
    const down = healthy().takeDamage(60).vitality;
    expect(down.current).toBe(0);
    expect(down.regenerationDue(7)).toBe(0);
    expect(down.continuousRegenerationDue()).toBe(0);

    const risen = down.heal(1).vitality;
    expect(risen.current).toBe(1);
    expect(risen.regenerationDue(7)).toBeGreaterThan(0);
    expect(risen.continuousRegenerationDue()).toBeGreaterThan(0);
  });

  it("плата кровью проверяет свои пределы сама", () => {
    const sunlit = Vitality.of({
      hitPoints: { current: 60, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
      temporaryHitPoints: 0,
      hitDice: { total: 7, size: 6, remaining: 7 },
      suppression: { firedUponTurnStarts: 0, underDirectSunlight: true },
    });

    expect(() => sunlit.payWithBlood(6)).toThrow(/солнечным светом/);
    expect(sunlit.payWithBlood(6, { allowAnyway: true }).current).toBe(54);

    expect(() => healthy().payWithBlood(0)).toThrow(DomainError);
    expect(() => healthy().payWithBlood(2.5)).toThrow(DomainError);
    expect(() => healthy().payWithBlood(61)).toThrow(/в наличии 60/);
  });

  it("час поднимает ступень максимума и лечит уже от неё", () => {
    const bled = healthy().payWithBlood(9);
    const { vitality, returned, healed } = bled.takeDamage(31).vitality.afterAnHour(7);

    expect(returned).toBe(3);
    expect(vitality.maximum).toBe(54);
    expect(healed).toBe(7);
    expect(vitality.current).toBe(27);
  });
});

describe("срок подавления огнём", () => {
  const burned = () => {
    const base = Vitality.of({
      hitPoints: { current: 20, maximumBase: 60, bloodReduction: 0, masterReduction: 0 },
      temporaryHitPoints: 0,
      hitDice: { total: 7, size: 6, remaining: 7 },
      suppression: { firedUponTurnStarts: 0, underDirectSunlight: false },
    });
    return base.takeDamage(5, { fire: true }).vitality;
  };

  it("подавление огнём переживает начало следующего хода", () => {
    const nextTurn = burned().afterTurnStart();
    expect(nextTurn.firedUpon).toBe(true);
    expect(nextTurn.regenerationDue(7)).toBe(0);
  });

  it("отметка за сроком снимает подавление огнём", () => {
    const afterNextTurn = burned().afterTurnStart().afterTurnStart();
    expect(afterNextTurn.firedUpon).toBe(false);
    expect(afterNextTurn.regenerationDue(7)).toBeGreaterThan(0);
  });

  it("повторный урон огнём начинает срок сначала", () => {
    const again = burned().afterTurnStart().takeDamage(3, { fire: true }).vitality;
    expect(again.afterTurnStart().firedUpon).toBe(true);
  });

  it("отдых кончает срок целиком, отметок не дожидаясь", () => {
    expect(burned().clearFireSuppression().firedUpon).toBe(false);
  });

  it("отметка хода без подавления ничего не отмеряет", () => {
    expect(burned().clearFireSuppression().afterTurnStart().firedUpon).toBe(false);
  });
});
