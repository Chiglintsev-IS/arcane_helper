import { describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

import { itemMeta } from "./itemMeta";

/** Перечни строит настоящий презентер: подделка рядом проверяла бы себя, а не приложение. */
const { stats } = toChoicesView();

/** Вещь так, как её показывает список: проекцию строит настоящий презентер. */
function viewOf(definition: ItemDefinition): ItemView {
  const state = createThorne();
  const found = toBagView({
    ...state,
    itemDefinitions: [...state.itemDefinitions, definition],
  }).items.find((item) => item.id === definition.id);
  if (found === undefined) throw new Error(`нет вещи ${definition.id}`);
  return found;
}

/** Надетая вещь Торна: она и есть предмет разговора, а её копия рядом отвечала бы за себя. */
function wornOf(id: string): ItemView {
  const found = toBagView(createThorne()).items.find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет вещи ${id}`);
  return found;
}

describe("вторая строка вещи", () => {
  it("однородное приходит одним фактом: спасброски плаща защиты — целое", () => {
    // Семь чисел плаща — одна прибавка при двух именах: свернул их владелец, строка не пересобирает.
    expect(itemMeta(wornOf("cloak-of-protection"), stats)).toEqual({
      facts: [{ valueRu: "+1", labelsRu: ["Класс Доспеха", "Все спасброски"] }],
      note: undefined,
    });
  });

  it("цена и прибавки — неделимые факты второй строки, заметка — свободный текст", () => {
    // Прибавки приезжают теми, что действуют: чьей категории они не положены, у того их и нет —
    // это стережёт владелец вещи, и второй такой проверки здесь не заводится.
    expect(
      itemMeta(
        viewOf({
          id: "healing-potion",
          nameRu: "Зелье лечения",
          kind: "consumable",
          price: { amount: 50, currency: "gold" },
        }),
        stats,
      ),
    ).toEqual({ facts: [{ valueRu: "50", labelsRu: ["зм"] }], note: undefined });
    // Прибавки стоят раньше цены: за столом вещь спрашивают о том, что она делает, а не почём она.
    expect(
      itemMeta(
        viewOf({
          id: "ring",
          nameRu: "Кольцо",
          kind: "gear",
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
      note: "фамильное",
    });
    // Числа разные — прибавки разные, и каждая называет свои величины.
    expect(
      itemMeta(
        viewOf({
          id: "staff",
          nameRu: "Посох",
          kind: "gear",
          bonuses: { armorClass: 1, spellSaveDc: 2, spellAttackModifier: 2 },
        }),
        stats,
      ),
    ).toEqual({
      facts: [
        { valueRu: "+1", labelsRu: ["Класс Доспеха"] },
        { valueRu: "+2", labelsRu: ["КС спасброска", "Атака заклинанием"] },
      ],
      note: undefined,
    });
    expect(itemMeta(viewOf({ id: "rope", nameRu: "Верёвка", kind: "other" }), stats)).toEqual({
      facts: [],
      note: undefined,
    });
  });
});
