import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

/**
 * Числа и отметки Торна сверяются с его бумажным листом: расхождение здесь игрок называет вслух за
 * столом, а приложение о нём молчит.
 */
describe("Торн сверяется с бумажным листом", () => {
  it("владения навыками Торна совпадают с листом", () => {
    expect(createThorne().skills).toEqual({
      arcana: "proficient",
      investigation: "proficient",
      nature: "proficient",
      perception: "proficient",
      sleightOfHand: "proficient",
      survival: "proficient",
    });
  });

  it("размер Торна совпадает с листом", () => {
    expect(createThorne().size).toBe("medium");
  });

  it("у Торна есть «Рунный почерк» — особенность предыстории", () => {
    expect(createThorne().features).toEqual([
      {
        nameRu: "Рунный почерк",
        summaryRu:
          "Минута изучения записи отвечает, один ли у двух записей автор, есть ли позднейшая вставка, менялась ли структура.",
      },
    ]);
  });
});
