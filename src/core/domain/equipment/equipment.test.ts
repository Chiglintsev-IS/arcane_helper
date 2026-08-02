import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import { Equipment } from "@/core/domain/equipment/equipment";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { InventoryItem } from "@/core/domain/character/state";

const ring = (worn: boolean): InventoryItem => ({
  id: "ring",
  nameRu: "Кольцо защиты",
  worn,
  bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
});

const gear = () => Equipment.of(createThorne());

describe("снаряжение", () => {
  it("прибавка складывается из непривязанных и надетых вещей", () => {
    expect(gear().bonuses).toEqual({ spellcasting: 1, armorClass: 2, savingThrows: 1 });

    const worn = gear().addItem(ring(true));
    expect(worn.bonuses).toEqual({ spellcasting: 1, armorClass: 3, savingThrows: 2 });
  });

  it("лежащее в сумке к числам не прибавляется", () => {
    expect(gear().addItem(ring(false)).bonuses).toEqual(gear().bonuses);
  });

  it("вещь без прибавки на числа не влияет", () => {
    const rope = gear().addItem({ id: "rope", nameRu: "Верёвка", worn: true });
    expect(rope.bonuses).toEqual(gear().bonuses);
  });

  it("надевание и снятие переключают вклад", () => {
    const carried = gear().addItem(ring(false));
    expect(carried.toggleWorn("ring").bonuses.armorClass).toBe(3);
    expect(carried.toggleWorn("ring").toggleWorn("ring").bonuses.armorClass).toBe(2);
  });

  it("вещь правится и убирается", () => {
    const worn = gear().addItem(ring(true));
    expect(worn.replaceItem({ ...ring(true), nameRu: "Кольцо защиты +1" }).items[0]?.nameRu).toBe(
      "Кольцо защиты +1",
    );
    expect(worn.removeItem("ring").items).toEqual([]);
  });

  it("правка одной вещи соседних не трогает", () => {
    const two = gear()
      .addItem(ring(true))
      .addItem({ id: "rope", nameRu: "Верёвка", worn: false });
    const renamed = two.replaceItem({ ...ring(true), nameRu: "Кольцо защиты +1" });

    expect(renamed.items.map((item) => item.nameRu)).toEqual(["Кольцо защиты +1", "Верёвка"]);
  });

  it("повтор, отсутствие вещи и порча данных отвергаются с причиной", () => {
    const worn = gear().addItem(ring(true));
    expect(() => worn.addItem(ring(true))).toThrow(DomainError);
    expect(() => gear().replaceItem(ring(true))).toThrow(DomainError);
    expect(() => gear().removeItem("ring")).toThrow(DomainError);
    expect(() => gear().toggleWorn("ring")).toThrow(DomainError);
  });

  it("база Класса Доспеха правится и проверяется", () => {
    expect(gear().withArmorClassBase(15).armorClassBase).toBe(15);
    expect(() => gear().withArmorClassBase(0)).toThrow(DomainError);
    expect(() => gear().withArmorClassBase(1.5)).toThrow(DomainError);
  });

  it("прибавки без вещи правятся отдельно от инвентаря", () => {
    const changed = gear().withOtherBonuses({ spellcasting: 0, armorClass: 0, savingThrows: 0 });
    expect(changed.otherBonuses.spellcasting).toBe(0);
    expect(changed.bonuses).toEqual({ spellcasting: 0, armorClass: 0, savingThrows: 0 });
  });

  it("отсутствие записи о компонентах — не пустая сумка, а незнание", () => {
    const base = createThorne();
    const { components: _none, ...withoutComponents } = base.equipment;

    expect(gear().known).toBe(true);
    expect(Equipment.of({ ...base, equipment: withoutComponents }).known).toBe(false);
    expect(Equipment.of({ ...base, equipment: withoutComponents }).replacesFreeComponents).toBe(
      false,
    );
    expect(() =>
      Equipment.of({ ...base, equipment: withoutComponents }).toggleMaterial("identify"),
    ).toThrow(DomainError);
  });

  it("фокусировка заменяет компоненты без стоимости, дорогой ищется поимённо", () => {
    expect(gear().replacesFreeComponents).toBe(true);
    expect(gear().hasMaterialFor("identify")).toBe(false);

    const bought = gear().toggleMaterial("identify");
    expect(bought.owned).toBe(true);
    expect(bought.equipment.hasMaterialFor("identify")).toBe(true);
    expect(bought.equipment.toggleMaterial("identify").owned).toBe(false);
  });
});
