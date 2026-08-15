import { describe, expect, it } from "vitest";

import { characterFeaturesSchema } from "./features";

describe("особенности персонажа", () => {
  it("особенность хранит название и то, что она даёт словами", () => {
    const features = characterFeaturesSchema.parse([
      { nameRu: "Рунный почерк", summaryRu: "Минута изучения записи отвечает на четыре вопроса." },
    ]);

    expect(features).toEqual([
      { nameRu: "Рунный почерк", summaryRu: "Минута изучения записи отвечает на четыре вопроса." },
    ]);
  });

  it("особенность без названия и без описания не годится", () => {
    expect(
      characterFeaturesSchema.safeParse([{ nameRu: "", summaryRu: "Отвечает на четыре вопроса." }])
        .success,
    ).toBe(false);
    expect(
      characterFeaturesSchema.safeParse([{ nameRu: "Рунный почерк", summaryRu: "" }]).success,
    ).toBe(false);
  });

  it("числа особенность не хранит: лишнее поле до состояния не доезжает", () => {
    expect(
      characterFeaturesSchema.parse([
        { nameRu: "Рунный почерк", summaryRu: "Отвечает на четыре вопроса.", bonuses: { armorClass: 1 } },
      ]),
    ).toEqual([{ nameRu: "Рунный почерк", summaryRu: "Отвечает на четыре вопроса." }]);
  });

  it("прежнее сохранение получает пустой список особенностей", () => {
    expect(characterFeaturesSchema.parse(undefined)).toEqual([]);
  });
});
