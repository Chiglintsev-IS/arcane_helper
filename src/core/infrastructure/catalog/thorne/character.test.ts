import { describe, expect, it } from "vitest";

import { Character } from "@/core/domain/assembly/character";
import { mixtureKinds } from "@/core/application/useCases/crafting";
import { Items } from "@/core/domain/items/items";
import { RECIPE_CHOICES } from "@/core/domain/crafting/recipe";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

/**
 * Верстак на настоящем каталоге, а не на придуманном составе: у видов Торна общих свойств нет, и
 * замысел держится на одиночных реакциях, которые стол утвердил поимённо. Прогон на выдуманных
 * видах этого не показывает — он сам себе выдаёт совпадение.
 */
function pricedAlone(nameRu: string): { readonly mainRu: string; readonly total: number } {
  const root = Character.of(createThorne());
  const kinds = mixtureKinds(root.items, [Items.idFromName(nameRu)]);
  const cost = root.crafting.costOf(kinds, {
    ...RECIPE_CHOICES.standard,
    kinds: kinds.map((kind) => kind.id),
    mainProperty: null,
    suppressed: [],
    limitations: [],
  });
  return { mainRu: cost.mainRu, total: cost.total };
}

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

  it("одиночная реакция даёт замысел там, где второго вида нет", () => {
    expect(pricedAlone("Дварфийская хворь")).toEqual({ mainRu: "Отвращение к пиву", total: 10 });
    expect(pricedAlone("Корень мандрагоры")).toEqual({
      mainRu: "Постоянное усиление случайной характеристики",
      total: 10,
    });
  });

  it("записанные рецепты отряда стоят столько, сколько назвал стол", () => {
    const root = Character.of(createThorne());
    const priced = root.crafting.recipes.map((formula) => ({
      mainRu: formula.mainProperty,
      total: root.crafting.costOf(mixtureKinds(root.items, formula.kinds), formula).total,
    }));

    expect(priced).toEqual([
      { mainRu: "Постоянное усиление случайной характеристики", total: 38 },
      { mainRu: "Отвращение к пиву", total: 10 },
    ]);
  });
});
