import { describe, expect, it } from "vitest";

import { Arcana } from "@/core/domain/arcana/arcana";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

const arcana = () => Arcana.of(createThorne());

describe("отметка короткого отдыха у ресурсов (FR-131)", () => {
  it("сохранение без отметки читается как «отдыха не было»", () => {
    expect(arcana().arcaneRecoveryUnavailability()).toBe("Берётся после короткого отдыха");
  });

  it("отметка снимает причину, по которой восстановление не берётся", () => {
    expect(arcana().markShortRest().arcaneRecoveryUnavailability()).toBeNull();
  });

  it("долгий отдых снимает отметку — восстановление снова ждёт короткого", () => {
    expect(arcana().markShortRest().restoredByLongRest().arcaneRecoveryUnavailability()).toBe(
      "Берётся после короткого отдыха",
    );
  });

  it("отметка переживает пересборку объекта-значения: следующая правка ячеек её не теряет", () => {
    const marked = arcana().markShortRest().toState();
    expect(Arcana.of(marked).spendSlot(1).arcaneRecoveryUnavailability()).toBeNull();
  });
});

describe("последняя подсказка (FR-309)", () => {
  it("истраченная остаётся нулём и второй раз не тратится", () => {
    const spent = arcana().shiftLastHint(-1);

    expect(spent.lastHint.remaining).toBe(0);
    expect(() => spent.shiftLastHint(-1)).toThrow(/от 0 до 1/);
  });
});
