import { describe, expect, it } from "vitest";

import { toCraftingView } from "./craftingView";

import { Character } from "@/core/domain/assembly/character";
import { Items } from "@/core/domain/items/items";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import {
  withIngredientKnowledge,
  withoutIngredientKnowledge,
} from "@/core/infrastructure/catalog/thorne/fixtures";

describe("проекция знания об ингредиентах", () => {
  it("мастерская едет одним набором на всю алхимию", () => {
    expect(toCraftingView(createThorne()).workshop).toEqual({
      apparatusRu: "Надёжный походный комплект",
    });
  });

  it("знание едет проекцией видами и раскрытым у них", () => {
    const known = withIngredientKnowledge(
      withoutIngredientKnowledge(createThorne()),
      "Лунная трава",
      [
        { number: 1, nameRu: "Лечение здоровья" },
        { number: 3, nameRu: "Взрыв" },
      ],
    );

    expect(toCraftingView(known).ingredients).toEqual([
      {
        itemId: Items.idFromName("Лунная трава"),
        nameRu: "Лунная трава",
        inBag: 0,
        piecesPerPortion: 1,
        portionsInBag: 0,
        shortageRu: "В сумке 0, столько не потратить",
        researchNumbers: [2, 4],
        properties: [
          { number: 1, nameRu: "Лечение здоровья" },
          { number: 3, nameRu: "Взрыв" },
        ],
        notes: [],
      },
    ]);
  });

  it("записанный вид без раскрытого едет пустым списком свойств", () => {
    const noted = withIngredientKnowledge(
      withoutIngredientKnowledge(createThorne()),
      "Багровый корень",
    );

    expect(toCraftingView(noted).ingredients).toEqual([
      {
        itemId: Items.idFromName("Багровый корень"),
        nameRu: "Багровый корень",
        inBag: 0,
        piecesPerPortion: 1,
        portionsInBag: 0,
        shortageRu: "В сумке 0, столько не потратить",
        researchNumbers: [1, 2, 3, 4],
        properties: [],
        notes: [],
      },
    ]);
  });

  it("наблюдения о виде едут вместе с ним, каждое своей записью", () => {
    const seen = withIngredientKnowledge(
      withoutIngredientKnowledge(createThorne()),
      "Багровый корень",
    );
    const rootId = Items.idFromName("Багровый корень");
    const noted = toCraftingView(
      Character.of(seen)
        .withItems(
          Character.of(seen)
            .items.addNote(rootId, { id: "one", textRu: "Пахнет тиной" })
            .addNote(rootId, { id: "two", textRu: "Мастер сказал: не варить" }),
        )
        .toState(),
    );

    expect(noted.ingredients[0]?.notes).toEqual([
      { id: "one", textRu: "Пахнет тиной" },
      { id: "two", textRu: "Мастер сказал: не варить" },
    ]);
  });

  it("не записано ничего — не едет ни один вид", () => {
    expect(
      toCraftingView(withoutIngredientKnowledge(createThorne())).ingredients,
    ).toEqual([]);
  });
});
