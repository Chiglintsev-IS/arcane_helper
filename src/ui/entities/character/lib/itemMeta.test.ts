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

describe("вторая строка вещи", () => {
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
    ).toEqual({ facts: ["50 зм"], note: undefined });
    expect(
      itemMeta(
        viewOf({
          id: "ring",
          nameRu: "Кольцо",
          kind: "gear",
          note: "фамильное",
          bonuses: { armorClass: 1, "save:constitution": 1 },
        }),
        stats,
      ),
    ).toEqual({
      facts: ["Класс Доспеха +1", "Спасбросок: Телосложение +1"],
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
    ).toEqual({ facts: ["КС спасброска +2", "Атака заклинанием +2"], note: undefined });
    expect(itemMeta(viewOf({ id: "rope", nameRu: "Верёвка", kind: "other" }), stats)).toEqual({
      facts: [],
      note: undefined,
    });
  });
});
