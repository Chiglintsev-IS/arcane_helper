import { describe, expect, it } from "vitest";

import { castingTimeLabel } from "./format";

describe("castingTimeLabel (FR-033)", () => {
  it("действие, бонусное действие и реакция называются словом", () => {
    expect(castingTimeLabel({ type: "action" })).toBe("Действие");
    expect(castingTimeLabel({ type: "bonus_action" })).toBe("Бонусное");
    expect(castingTimeLabel({ type: "reaction", reactionTrigger: "в вас попали" })).toBe("Реакция");
  });

  it("минуты и часы называются числом: «1 минута», а не «Минуты»", () => {
    expect(castingTimeLabel({ type: "minute", value: 1 })).toBe("1 минута");
    expect(castingTimeLabel({ type: "minute", value: 10 })).toBe("10 минут");
    expect(castingTimeLabel({ type: "hour", value: 1 })).toBe("1 час");
  });

  it("без числа остаётся категория: врать о времени хуже, чем назвать его приблизительно", () => {
    expect(castingTimeLabel({ type: "minute" })).toBe("Минуты");
  });
});
