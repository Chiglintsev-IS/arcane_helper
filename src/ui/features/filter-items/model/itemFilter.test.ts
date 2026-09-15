import { describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { toBagView } from "@/core/presentation/views/bagView";
import { createWizard } from "@/core/infrastructure/catalog/thorne/fixtures";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";

import { cycled, NO_SIFT, sifts, stanceOf } from "./itemFilter";

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

const herb = viewOf({ id: "herb", nameRu: "Подорожник", kinds: [], notes: [], alchemy: { properties: [] } });
const ring = viewOf({ id: "ring", nameRu: "Кольцо защиты", kinds: ["gear"], notes: [] });

describe("сито по признакам", () => {
  it("нажатие ведёт чип по кругу: только это, кроме этого, снято", () => {
    const only = cycled(NO_SIFT, "ingredient");
    const except = cycled(only, "ingredient");

    expect(stanceOf(only, "ingredient")).toBe("only");
    expect(stanceOf(except, "ingredient")).toBe("not");
    expect(cycled(except, "ingredient")).toEqual(NO_SIFT);
    expect(stanceOf(NO_SIFT, "ingredient")).toBeUndefined();
  });

  it("«всё, кроме ингредиентов» набирается одним нажатием", () => {
    const except = cycled(cycled(NO_SIFT, "ingredient"), "ingredient");

    expect(sifts(herb, except, "")).toBe(false);
    expect(sifts(ring, except, "")).toBe(true);
  });

  it("затребованные признаки нужны все разом", () => {
    const both = cycled(cycled(NO_SIFT, "gear"), "ingredient");

    expect(sifts(ring, cycled(NO_SIFT, "gear"), "")).toBe(true);
    expect(sifts(ring, both, "")).toBe(false);
  });

  it("поиск по названию сужает наравне с ситом", () => {
    expect(sifts(herb, NO_SIFT, "подор")).toBe(true);
    expect(sifts(herb, NO_SIFT, "кольцо")).toBe(false);
    expect(sifts(herb, cycled(NO_SIFT, "gear"), "подор")).toBe(false);
  });
});
