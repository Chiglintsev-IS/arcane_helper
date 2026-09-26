import { describe, expect, it } from "vitest";

import { DomainError } from "@/core/domain/shared/errors";
import { createSession, undoLast, type Occasion, type Session } from "@/core/application/session";
import { createWizard } from "@/core/infrastructure/catalog/thorne/fixtures";

import { setTemporaryHitPoints } from "./health";

function testOccasion(commandId = "command-1"): Occasion {
  let tick = 0;
  return {
    now: () => new Date(Date.UTC(2026, 8, 26, 20, 0, tick)).toISOString(),
    nextId: () => `id-${++tick}`,
    commandId,
  };
}

const occasion = testOccasion();

const fresh = (): Session => createSession(createWizard());

describe("запись временных хитов", () => {
  it("число встаёт отдельно от хитов, лог называет было и стало", () => {
    const after = setTemporaryHitPoints(fresh(), 8, occasion);

    expect(after.character.temporaryHitPoints).toBe(8);
    expect(after.character.hitPoints.current).toBe(60);
    expect(after.log.at(-1)).toMatchObject({
      kind: "hit_points_changed",
      summaryRu: "Временные хиты: 0 → 8",
    });
  });

  it("меньшее встаёт как есть: временные не складываются, и выбирает игрок", () => {
    const granted = setTemporaryHitPoints(fresh(), 8, occasion);
    const after = setTemporaryHitPoints(granted, 5, occasion);

    expect(after.character.temporaryHitPoints).toBe(5);
    expect(after.log.at(-1)?.summaryRu).toBe("Временные хиты: 8 → 5");
  });

  it("ноль снимает временные хиты", () => {
    const granted = setTemporaryHitPoints(fresh(), 8, occasion);
    const after = setTemporaryHitPoints(granted, 0, occasion);

    expect(after.character.temporaryHitPoints).toBe(0);
    expect(after.log.at(-1)?.summaryRu).toBe("Временные хиты сняты");
  });

  it("то же число записи не пишет и сессию не меняет", () => {
    const granted = setTemporaryHitPoints(fresh(), 8, occasion);

    expect(setTemporaryHitPoints(granted, 8, occasion)).toBe(granted);
    expect(setTemporaryHitPoints(fresh(), 0, occasion).log).toHaveLength(0);
  });

  it("запись не урон: проверке концентрации читать нечего", () => {
    const after = setTemporaryHitPoints(fresh(), 8, occasion);
    expect(after.log.at(-1)).not.toHaveProperty("damage");
  });

  it("отмена возвращает прежние временные хиты", () => {
    const granted = setTemporaryHitPoints(fresh(), 8, occasion);
    const replaced = setTemporaryHitPoints(granted, 3, occasion);

    expect(undoLast(replaced).character.temporaryHitPoints).toBe(8);
  });

  it.each([-1, 2.5])("недопустимое %s отвергается, сессия не тронута", (amount) => {
    const before = fresh();
    expect(() => setTemporaryHitPoints(before, amount, occasion)).toThrow(DomainError);
    expect(before.character.temporaryHitPoints).toBe(0);
  });
});
