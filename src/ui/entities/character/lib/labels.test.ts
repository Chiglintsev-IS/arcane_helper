import { describe, expect, it } from "vitest";

import { currencyAbbr, DERIVED_LABELS, skillLabel } from "./labels";

describe("подписи навыков", () => {
  it("навык зовётся именем бумажного листа", () => {
    expect(skillLabel("arcana")).toBe("Аркана");
    expect(skillLabel("investigation")).toBe("Анализ");
    expect(skillLabel("perception")).toBe("Внимательность");
  });

  it("величина, выведенная из навыка, носит его имя", () => {
    expect(DERIVED_LABELS.passivePerception.toLowerCase()).toContain(
      skillLabel("perception").toLowerCase(),
    );
  });
});

describe("слово вне словаря подписей", () => {
  it("монета, которой словарь ещё не знает, доезжает до экрана своим словом", () => {
    expect(currencyAbbr("platinum")).toBe("platinum");
  });
});
