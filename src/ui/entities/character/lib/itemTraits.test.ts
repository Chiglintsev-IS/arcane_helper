import { describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { toBagView } from "@/core/presentation/views/bagView";
import { createWizard } from "@/core/infrastructure/catalog/thorne/fixtures";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";

import { ITEM_TRAITS, itemTraitLabel, itemTraitsOf } from "./itemTraits";

const spells = loadThorneSpells();

function viewOf(definition: ItemDefinition): ItemView {
  const state = createWizard();
  const found = toBagView(
    { ...state, itemDefinitions: [...state.itemDefinitions, definition] },
    spells,
  ).items.find((item) => item.id === definition.id);
  if (found === undefined) throw new Error(`нет вещи ${definition.id}`);
  return found;
}

describe("признаки вещи", () => {
  it("каждый признак назван своим словом", () => {
    expect(ITEM_TRAITS.map(itemTraitLabel)).toEqual(["Экипировка", "Ингредиент", "Хочу купить"]);
  });

  it("фокусировка признаком не зовётся: ею проводят магию, а носят как экипировку", () => {
    const wand = viewOf({
      id: "wand",
      nameRu: "Палочка",
      kinds: ["gear"],
      notes: [],
      spellcastingFocus: true,
    });

    expect(itemTraitsOf(wand)).toEqual(["gear"]);
  });

  it("признаки набираются вместе, а не выбираются по одному", () => {
    const mail = viewOf({
      id: "mithral",
      nameRu: "Мифриловая кольчуга",
      kinds: ["gear"],
      notes: [],
      spellcastingFocus: true,
      alchemy: { properties: [] },
    });

    expect(itemTraitsOf(mail)).toEqual(["gear", "ingredient"]);
    expect(itemTraitsOf({ ...mail, wanted: true })).toContain("wanted");
  });

  it("у вещи без признаков их нет вовсе: «другое» — это пустой набор", () => {
    expect(itemTraitsOf(viewOf({ id: "rope", nameRu: "Верёвка", kinds: [], notes: [] }))).toEqual(
      [],
    );
  });
});
