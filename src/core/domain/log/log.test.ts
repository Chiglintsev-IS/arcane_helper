import { describe, expect, it } from "vitest";

import { Log } from "./log";

type Vitality = { hitPoints: number };

const MUTABLE = ["hitPoints"] as const;
const AT = "2026-08-09T12:00:00.000Z";
const RECORDED = { kind: "hit_points_changed", summaryRu: "Получено урона: 3" } as const;

function afterDamage(stamp: { id: string; at: string; commandId?: string }) {
  return Log.of<Vitality>([], MUTABLE).append(
    { hitPoints: 10 },
    { hitPoints: 7 },
    RECORDED,
    stamp,
  );
}

describe("отметка попытки в записи лога", () => {
  it("сохраняет идентификатор попытки, когда он назван", () => {
    const log = afterDamage({ id: "entry-1", at: AT, commandId: "command-1" });

    expect(log.last?.commandId).toBe("command-1");
  });

  it("обходится без него: запись, сделанная не по команде, остаётся записью", () => {
    const log = afterDamage({ id: "entry-1", at: AT });

    expect(log.last).not.toHaveProperty("commandId");
    expect(log.last?.summaryRu).toBe(RECORDED.summaryRu);
  });
});
