import { describe, expect, it } from "vitest";

import { outlastsLongRest } from "@/core/domain/effects/duration";

describe("судьба срока при долгом отдыхе", () => {
  it("срок, отмеряемый временем, долгого отдыха не переживает", () => {
    expect(outlastsLongRest({ type: "rounds" })).toBe(false);
    expect(outlastsLongRest({ type: "minutes" })).toBe(false);
    expect(outlastsLongRest({ type: "hours" })).toBe(false);
  });

  it("срок, который отмеряет не время, долгий отдых переживает", () => {
    expect(outlastsLongRest({ type: "until_spell_ends" })).toBe(true);
    expect(outlastsLongRest({ type: "until_removed" })).toBe(true);
  });
});
