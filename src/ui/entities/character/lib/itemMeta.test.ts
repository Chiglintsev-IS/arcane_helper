import { describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { createWizard } from "@/core/infrastructure/catalog/thorne/fixtures";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";

import { itemMeta } from "./itemMeta";

const spells = loadThorneSpells();

const { stats } = toChoicesView();

function viewOf(definition: ItemDefinition): ItemView {
  const state = createWizard();
  const found = toBagView({
    ...state,
    itemDefinitions: [...state.itemDefinitions, definition],
  }, spells).items.find((item) => item.id === definition.id);
  if (found === undefined) throw new Error(`нет вещи ${definition.id}`);
  return found;
}

function wornOf(id: string): ItemView {
  const found = toBagView(createWizard(), spells).items.find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет вещи ${id}`);
  return found;
}

describe("вторая строка вещи", () => {
  it("однородное приходит одним фактом: спасброски плаща защиты — целое", () => {
    expect(itemMeta(wornOf("cloak-of-protection"), stats)).toEqual({
      facts: [{ valueRu: "+1", labelsRu: ["Класс Доспеха", "Все спасброски"] }],
      marksRu: [],
      notes: [],
    });
  });

  it("цена и прибавки — неделимые факты второй строки, заметка — свободный текст", () => {
    expect(
      itemMeta(
        viewOf({
          id: "healing-potion",
          nameRu: "Зелье лечения",
          notes: [],
          kinds: ["consumable"],
          price: { amount: 50, currency: "gold" },
        }),
        stats,
      ),
    ).toEqual({ facts: [{ valueRu: "50", labelsRu: ["зм"] }], marksRu: [], notes: [] });
    expect(
      itemMeta(
        viewOf({
          id: "ring",
          nameRu: "Кольцо",
          kinds: ["gear"],
          notes: [{ id: "one", textRu: "фамильное" }],
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
      notes: [{ id: "one", textRu: "фамильное" }],
    });
    expect(
      itemMeta(
        viewOf({
          id: "staff",
          nameRu: "Посох",
          notes: [],
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
      notes: [],
    });
    expect(itemMeta(viewOf({ id: "rope", nameRu: "Верёвка", kinds: [], notes: [] }), stats)).toEqual({
      facts: [],
      marksRu: [],
      notes: [],
    });
  });

  it("отметки называют условие действия прибавки и желание купить", () => {
    const stone = viewOf({
      id: "stone",
      nameRu: "Камень удачи",
      notes: [],
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
