import { describe, expect, it } from "vitest";

import { toCraftingView } from "./craftingView";

import { Character } from "@/core/domain/assembly/character";
import { Items } from "@/core/domain/items/items";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import {
  withIngredientKnowledge,
  withoutIngredientKnowledge,
} from "@/core/infrastructure/catalog/thorne/fixtures";

const MOON_HERB = "Лунная трава";
const CRIMSON_ROOT = "Багровый корень";
const HEALING = { number: 1, nameRu: "Лечение здоровья" } as const;

const FORMULA = {
  kinds: [Items.idFromName(MOON_HERB), Items.idFromName(CRIMSON_ROOT)],
  mainProperty: HEALING.nameRu,
  mainRarity: "Обычное",
  purified: false,
  duration: null,
  onset: "Немедленно",
  fullRepeats: 0,
  reach: "Одна цель, предмет или участок",
  application: "Выпить, накормить или нанести на неподвижную цель",
  resistance: "Положительное воздействие на добровольную цель",
  suppressed: [],
  limitations: [],
} as const;

describe("проекция знания об ингредиентах", () => {
  it("мастерская едет одним набором на всю алхимию", () => {
    expect(toCraftingView(createThorne()).workshop).toEqual({
      apparatusRu: "Надёжный походный комплект",
      hardest: 20,
      batch: 6,
      stationary: false,
    });
  });

  it("мастерская без набора едет пустым словом и пределами импровизации", () => {
    const bare = Character.of(createThorne());

    expect(toCraftingView(bare.withCrafting(bare.crafting.withWorkshop({})).toState()).workshop)
      .toEqual({ apparatusRu: null, hardest: 15, batch: 1, stationary: false });
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
        portionsInBag: 0,
        shortageRu: "В сумке 0, столько не потратить",
        findDc: null,
        gatherDc: null,
        yieldRu: null,
        portionRu: null,
        price: null,
        researchNumbers: [2, 4],
        properties: [
          { number: 1, nameRu: "Лечение здоровья", dirRu: null, rarityRu: null },
          { number: 3, nameRu: "Взрыв", dirRu: null, rarityRu: null },
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
        portionsInBag: 0,
        shortageRu: "В сумке 0, столько не потратить",
        findDc: null,
        gatherDc: null,
        yieldRu: null,
        portionRu: null,
        price: null,
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

  it("записанный рецепт едет ценой замысла и перечислением видов", () => {
    const known = [MOON_HERB, CRIMSON_ROOT].reduce(
      (character, kind) => withIngredientKnowledge(character, kind, [HEALING]),
      withoutIngredientKnowledge(createThorne()),
    );
    const recorded = Character.of(known);
    const recipe = toCraftingView(
      recorded.withCrafting(recorded.crafting.recordRecipe(FORMULA)).toState(),
    ).recipes;

    expect(recipe).toHaveLength(1);
    expect(recipe[0]).toMatchObject({
      nameRu: HEALING.nameRu,
      kindsRu: [MOON_HERB, CRIMSON_ROOT],
      difficulty: 10,
      minutes: 30,
      consumablesRu: "Обычные",
      refusalRu: null,
    });
  });

  it("рецепт, чьё знание рассыпалось, остаётся записью и называет причину вместо чисел", () => {
    const bare = Character.of(withoutIngredientKnowledge(createThorne()));
    const orphan = toCraftingView(
      bare
        .withCrafting(
          bare.crafting.recordRecipe({
            ...FORMULA,
            mainProperty: null,
            suppressed: [{ nameRu: "Диарея", rarityRu: "Обычное" }],
          }),
        )
        .toState(),
    ).recipes;

    expect(orphan[0]).toMatchObject({
      nameRu: [MOON_HERB, CRIMSON_ROOT].map((nameRu) => Items.idFromName(nameRu)).join(", "),
      kindsRu: [Items.idFromName(MOON_HERB), Items.idFromName(CRIMSON_ROOT)],
      difficulty: null,
      minutes: null,
    });
    expect(orphan[0]?.formula.suppressed).toEqual([{ nameRu: "Диарея", rarityRu: "Обычное" }]);
    expect(orphan[0]?.refusalRu).toMatch(/нет среди заведённых вещей/);
  });

  it("не записано ничего — не едет ни один вид", () => {
    expect(
      toCraftingView(withoutIngredientKnowledge(createThorne())).ingredients,
    ).toEqual([]);
  });
});
