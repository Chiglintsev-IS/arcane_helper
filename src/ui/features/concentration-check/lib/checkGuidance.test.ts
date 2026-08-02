import { describe, expect, it } from "vitest";

import { describeConcentrationCheck } from "@/core/domain/effects/concentration";
import { checkGuidanceRu } from "@/ui/features/concentration-check/lib/checkGuidance";

describe("checkGuidanceRu", () => {
  it("называет наименьший проходящий бросок", () => {
    expect(checkGuidanceRu(describeConcentrationCheck(24, 4))).toBe("Бросьте d20, нужно 8 и выше");
  });

  it("предупреждает о преимуществе", () => {
    expect(checkGuidanceRu(describeConcentrationCheck(24, 4, { hasAdvantage: true }))).toBe(
      "Бросьте d20 с преимуществом, нужно 8 и выше",
    );
  });

  it("говорит, что проходит любой бросок", () => {
    expect(checkGuidanceRu(describeConcentrationCheck(10, 9))).toBe("Проходит любой бросок d20");
  });

  it("говорит, что бросок не спасёт", () => {
    expect(checkGuidanceRu(describeConcentrationCheck(60, 4))).toBe(
      "Не проходит даже 20: концентрация держится только руной",
    );
  });
});
