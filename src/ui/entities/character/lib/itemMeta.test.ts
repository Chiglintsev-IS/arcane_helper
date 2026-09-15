import { describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { createWizard } from "@/core/infrastructure/catalog/thorne/fixtures";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";

import { bonusLine, neededForLine, traitLine, unitRu } from "./itemMeta";

const spells = loadThorneSpells();

const { stats } = toChoicesView();

function viewOf(definition: ItemDefinition): ItemView {
  const state = createWizard();
  const found = toBagView(
    { ...state, itemDefinitions: [...state.itemDefinitions, definition] },
    spells,
  ).items.find((item) => item.id === definition.id);
  if (found === undefined) throw new Error(`нет вещи ${definition.id}`);
  return found;
}

function wornOf(id: string): ItemView {
  const found = toBagView(createWizard(), spells).items.find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет вещи ${id}`);
  return found;
}

describe("строки вещи", () => {
  it("однородные прибавки сходятся в одну: спасброски плаща защиты — целое", () => {
    expect(bonusLine(wornOf("cloak-of-protection"), stats)).toBe(
      "+1 Класс Доспеха · +1 Все спасброски",
    );
  });

  it("разные числа стоят разными фактами, а вещь без прибавок молчит", () => {
    expect(
      bonusLine(
        viewOf({
          id: "staff",
          nameRu: "Посох",
          notes: [],
          kinds: ["gear"],
          bonuses: { armorClass: 1, spellSaveDc: 2, spellAttackModifier: 2 },
        }),
        stats,
      ),
    ).toBe("+1 Класс Доспеха · +2 Сложность спасброска врага · +2 Попадание заклинанием");

    expect(bonusLine(viewOf({ id: "rope", nameRu: "Верёвка", kinds: [], notes: [] }), stats)).toBe(
      "",
    );
  });

  it("единицу счёта называет признак: ингредиент считают порциями, прочее — штуками", () => {
    const herb = viewOf({ id: "herb", nameRu: "Подорожник", kinds: [], notes: [], alchemy: { properties: [] } });
    const rope = viewOf({ id: "rope", nameRu: "Верёвка", kinds: [], notes: [] });

    expect([1, 2, 5, 48].map((count) => unitRu(herb, count))).toEqual([
      "порция",
      "порции",
      "порций",
      "порций",
    ]);
    expect(unitRu(rope, 2)).toBe("шт");
  });

  it("перечень признаков и перечень заклинаний называются одной чередой", () => {
    expect(traitLine(["Экипировка", "Ингредиент"])).toBe("Экипировка · Ингредиент");
    expect(traitLine([])).toBe("");
    expect(neededForLine([])).toBeUndefined();
    expect(neededForLine(["Огненный шар", "Щит"])).toBe("Требуется для: Огненный шар · Щит");
  });
});
