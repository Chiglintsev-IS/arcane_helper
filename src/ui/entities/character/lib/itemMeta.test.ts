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
    // Семь чисел плаща — два факта: имя семейства называет владелец, строка его не пересобирает.
    expect(itemMeta(wornOf("cloak-of-protection"), stats)).toEqual({
      facts: [
        { labelRu: "Класс Доспеха", valueRu: "+1" },
        { labelRu: "Все спасброски", valueRu: "+1" },
      ],
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
    ).toEqual({ facts: [{ labelRu: "50 зм", valueRu: undefined }], note: undefined });
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
        { labelRu: "Класс Доспеха", valueRu: "+1" },
        { labelRu: "Спасбросок: Телосложение", valueRu: "+1" },
        { labelRu: "3500 зм", valueRu: undefined },
      ],
      note: "фамильное",
    });
    expect(
      itemMeta(
        viewOf({
          id: "staff",
          nameRu: "Посох",
          kind: "gear",
          bonuses: { spellSaveDc: 2, spellAttackModifier: 2 },
        }),
        stats,
      ),
    ).toEqual({
      facts: [
        { labelRu: "КС спасброска", valueRu: "+2" },
        { labelRu: "Атака заклинанием", valueRu: "+2" },
      ],
      note: undefined,
    });
    expect(itemMeta(viewOf({ id: "rope", nameRu: "Верёвка", kind: "other" }), stats)).toEqual({
      facts: [],
      note: undefined,
    });
  });
});
