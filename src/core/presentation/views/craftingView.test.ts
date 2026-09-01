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
  it("закрытое направление едет с причиной, а изученные — своим списком", () => {
    const view = toCraftingView(createThorne());

    expect(view.workshop.closedDirections).toEqual([
      {
        direction: "poisons",
        reasonRu: expect.stringMatching(/ядов не варят/),
      },
    ]);
  });

  it("знание едет проекцией видами и раскрытым у них", () => {
    const known = withIngredientKnowledge(
      withoutIngredientKnowledge(createThorne()),
      "Лунная трава",
      [
        { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
        { number: 3, nameRu: "Взрыв", rarity: "rare" },
      ],
    );

    expect(toCraftingView(known).ingredients).toEqual([
      {
        itemId: Items.idFromName("Лунная трава"),
        nameRu: "Лунная трава",
        inBag: 0,
        properties: [
          { number: 1, nameRu: "Лечение здоровья", rarity: "common" },
          { number: 3, nameRu: "Взрыв", rarity: "rare" },
        ],
        observations: [],
        propertiesExhausted: false,
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
        properties: [],
        observations: [],
        propertiesExhausted: false,
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
            .items.noteObservation(rootId, { id: "one", textRu: "Пахнет тиной" })
            .noteObservation(rootId, { id: "two", textRu: "Мастер сказал: не варить" }),
        )
        .toState(),
    );

    expect(noted.ingredients[0]?.observations).toEqual([
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
