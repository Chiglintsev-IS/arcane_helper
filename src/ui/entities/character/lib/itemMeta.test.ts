import { describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";

import { itemMeta } from "./itemMeta";

const spells = loadThorneSpells();

const { stats } = toChoicesView();

function viewOf(definition: ItemDefinition): ItemView {
  const state = createThorne();
  const found = toBagView({
    ...state,
    itemDefinitions: [...state.itemDefinitions, definition],
  }, spells).items.find((item) => item.id === definition.id);
  if (found === undefined) throw new Error(`нет вещи ${definition.id}`);
  return found;
}

function wornOf(id: string): ItemView {
  const found = toBagView(createThorne(), spells).items.find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет вещи ${id}`);
  return found;
}

describe("вторая строка вещи", () => {
  it("однородное приходит одним фактом: спасброски плаща защиты — целое", () => {
    expect(itemMeta(wornOf("cloak-of-protection"), stats)).toEqual({
      facts: [{ valueRu: "+1", labelsRu: ["Класс Доспеха", "Все спасброски"] }],
      marksRu: [],
      note: undefined,
    });
  });

  it("цена и прибавки — неделимые факты второй строки, заметка — свободный текст", () => {
    expect(
      itemMeta(
        viewOf({
          id: "healing-potion",
          nameRu: "Зелье лечения",
          kinds: ["consumable"],
          price: { amount: 50, currency: "gold" },
        }),
        stats,
      ),
    ).toEqual({ facts: [{ valueRu: "50", labelsRu: ["зм"] }], marksRu: [], note: undefined });
    expect(
      itemMeta(
        viewOf({
          id: "ring",
          nameRu: "Кольцо",
          kinds: ["gear"],
          note: "фамильное",
          price: { amount: 3500, currency: "gold" },
          bonuses: { armorClass: 1, "save:constitution": 1 },
        }),
        stats,
      ),
    ).toEqual({
      facts: [
        { valueRu: "+1", labelsRu: ["Класс Доспеха", "Спасбросок: Телосложение"] },
        { valueRu: "3500", labelsRu: ["зм"] },
      ],
      marksRu: [],
      note: "фамильное",
    });
    expect(
      itemMeta(
        viewOf({
          id: "staff",
          nameRu: "Посох",
          kinds: ["gear"],
          bonuses: { armorClass: 1, spellSaveDc: 2, spellAttackModifier: 2 },
        }),
        stats,
      ),
    ).toEqual({
      facts: [
        { valueRu: "+1", labelsRu: ["Класс Доспеха"] },
        { valueRu: "+2", labelsRu: ["Сложность спасброска врага", "Попадание заклинанием"] },
      ],
      marksRu: [],
      note: undefined,
    });
    expect(itemMeta(viewOf({ id: "rope", nameRu: "Верёвка", kinds: [] }), stats)).toEqual({
      facts: [],
      marksRu: [],
      note: undefined,
    });
  });

  it("отметки называют условие действия прибавки и желание купить", () => {
    const stone = viewOf({
      id: "stone",
      nameRu: "Камень удачи",
      kinds: [],
      bonuses: { initiative: 1 },
      worksCarried: true,
    });
    expect(itemMeta(stone, stats).marksRu).toEqual(["действует при себе"]);
    expect(itemMeta({ ...stone, wanted: true }, stats).marksRu).toEqual([
      "действует при себе",
      "в покупках",
    ]);
  });
});
