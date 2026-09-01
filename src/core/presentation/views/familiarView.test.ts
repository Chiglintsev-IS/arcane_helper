import { describe, expect, it } from "vitest";

import { toFamiliarView } from "./familiarView";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

describe("проекция фамильяра", () => {
  it("числа приходят от бонуса мастерства контрактора, а не из содержимого", () => {
    const view = toFamiliarView(createThorne());

    expect(view.checks).toEqual([
      {
        nameRu: "Травничество",
        ability: "intelligence",
        value: 5,
        advantageRu: "На болоте в тусклом освещении или темноте.",
      },
      {
        nameRu: "Внимательность",
        ability: "wisdom",
        value: 6,
        advantageRu: "Проверки, основанные на обонянии.",
      },
    ]);
    expect(view.passivePerception).toBe(16);
  });

  it("статблок, черты и условия контракта едут целиком", () => {
    const view = toFamiliarView(createThorne());

    expect(view.nameRu).toBe("Королевский Фрубит");
    expect(view.armorClass).toBe(13);
    expect(view.speedsRu).toHaveLength(3);
    expect(view.scores.map((score) => score.modifier)).toEqual([-3, 3, 1, 2, 3, 1]);
    expect(view.traits[0]?.nameRu).toBe("Поиск ингредиентов");
    expect(view.obligationsRu).toHaveLength(5);
  });
});
