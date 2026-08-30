import { describe, expect, it } from "vitest";

import type { ConcentrationCheckView } from "@/contract/views";
import { checkGuidanceRu } from "@/ui/features/concentration-check/lib/checkGuidance";

function check(overrides: Partial<ConcentrationCheckView> = {}): ConcentrationCheckView {
  return {
    dc: 12,
    modifier: 4,
    hasAdvantage: false,
    minimumRoll: 8,
    outcome: "threshold",
    ...overrides,
  };
}

describe("checkGuidanceRu", () => {
  it("называет наименьший проходящий бросок", () => {
    expect(checkGuidanceRu(check())).toBe("Бросьте d20, нужно 8 и выше");
  });

  it("предупреждает о преимуществе", () => {
    expect(checkGuidanceRu(check({ hasAdvantage: true }))).toBe(
      "Бросьте d20 с преимуществом, нужно 8 и выше",
    );
  });

  it("говорит, что проходит любой бросок", () => {
    expect(checkGuidanceRu(check({ outcome: "any_roll" }))).toBe("Проходит любой бросок d20");
  });

  it("говорит, что бросок не спасёт", () => {
    expect(checkGuidanceRu(check({ outcome: "impossible" }))).toBe(
      "Не проходит даже 20: концентрация держится только руной",
    );
  });
});
