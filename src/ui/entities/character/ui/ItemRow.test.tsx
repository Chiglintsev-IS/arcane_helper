// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { materialOf } from "@/core/application/casting/material";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";

import { ItemRow } from "./ItemRow";

/** Карточки, по которым идёт игра: требование вещи называет карточка, а не вещь. */
const spells = loadThorneSpells();

afterEach(cleanup);

/** Перечни строит настоящий презентер: подделка рядом проверяла бы себя, а не приложение. */
const { stats } = toChoicesView();

/** Вещь так, как её показывает список: проекцию строит настоящий презентер. */
function viewOf(definition: ItemDefinition): ItemView {
  const state = createThorne();
  const found = toBagView({
    ...state,
    itemDefinitions: [...state.itemDefinitions, definition],
  }, spells).items.find((item) => item.id === definition.id);
  if (found === undefined) throw new Error(`нет вещи ${definition.id}`);
  return found;
}

/** Надетая вещь Торна: она и есть предмет разговора, а её копия рядом отвечала бы за себя. */
function wornOf(id: string): ItemView {
  const found = toBagView(createThorne(), spells).items.find((item) => item.id === id);
  if (found === undefined) throw new Error(`нет вещи ${id}`);
  return found;
}

function renderRow(item: ItemView, countRu?: string) {
  return render(
    <ul>
      <ItemRow
        item={item}
        stats={stats}
        {...(countRu === undefined ? {} : { countRu })}
        onOpen={() => {}}
      />
    </ul>,
  );
}

/** Плашка целиком: число ищется по нему самому, а вокруг него стоит всё, что оно двигает. */
function factAt(valueRu: string): string {
  const value = screen.getByText(valueRu);
  return value.parentElement?.textContent ?? "";
}

const staff: ItemDefinition = {
  id: "staff-of-power",
  nameRu: "Посох силы",
  kind: "gear",
  note: "требует настройки",
  bonuses: { spellSaveDc: 2, spellAttackModifier: 2 },
};

describe("строка вещи", () => {
  it("число строки стоит при имени, а не отодвигает подробности (FR-250)", () => {
    renderRow(viewOf(staff), "надето 1");

    // Число живёт в той же кнопке, что имя: подробностям под ними остаётся вся ширина строки.
    const open = screen.getByRole("button", { name: "Открыть: Посох силы" });
    expect(within(open).getByText("надето 1")).toBeDefined();
  });

  it("факт — своя плашка: число один раз и всё, что оно двигает (FR-250)", () => {
    renderRow(
      viewOf({
        ...staff,
        bonuses: { armorClass: 1, spellSaveDc: 2, spellAttackModifier: 2 },
        price: { amount: 3500, currency: "gold" },
      }),
    );

    // Плашка целиком держит число и всё, что этим числом названо: неделимость — свойство элемента.
    expect(factAt("+2")).toBe("+2 КС спасброска, Атака заклинанием");
    // Числа разные — плашки разные, и своё число каждая называет сама.
    expect(factAt("+1")).toBe("+1 Класс Доспеха");
    // Цена устроена так же: число, а при нём монета.
    expect(factAt("3500")).toBe("3500 зм");

    // Заметка — свободный текст после фактов, а не плашка.
    expect(screen.getByText("требует настройки")).toBeDefined();
  });

  it("прибавка не прячется за счётом: пять величин названы все (FR-250)", () => {
    renderRow(
      viewOf({
        id: "circlet-of-everything",
        nameRu: "Венец всего",
        kind: "gear",
        bonuses: {
          armorClass: 1,
          spellSaveDc: 1,
          spellAttackModifier: 1,
          initiative: 1,
          passivePerception: 1,
        },
      }),
    );

    expect(factAt("+1")).toBe(
      "+1 Класс Доспеха, КС спасброска, Атака заклинанием, Инициатива, Пассивная внимательность",
    );
    expect(screen.queryByText(/ещё/)).toBeNull();
  });

  it("однородное стоит одним фактом: шесть спасбросков не режутся счётом (FR-250)", () => {
    renderRow(wornOf("cloak-of-protection"));

    // Плащ двигает семь чисел, и все семь на строке названы: КД — своим именем, спасброски — целым.
    expect(factAt("+1")).toBe("+1 Класс Доспеха, Все спасброски");
    expect(screen.queryByText(/Спасбросок:/)).toBeNull();
  });

  it("строка вещи называет, чем вещь требуется (FR-295)", () => {
    const identify = spells.find((spell) => spell.id === "identify");
    const material = identify === undefined ? undefined : materialOf(identify.components);
    if (material === undefined) throw new Error("«Опознание» материала не требует");

    renderRow(viewOf(material));

    // Требование стоит тем же перечнем подробностей, что и цена: отдельной строки под него нет.
    expect(screen.getByText("Требуется для: Опознание")).toBeDefined();
    expect(factAt("100")).toBe("100 зм");
  });

  it("у вещи без подробностей второй строки нет вовсе (FR-250)", () => {
    renderRow(viewOf({ id: "rope", nameRu: "Верёвка", kind: "other" }));

    const open = screen.getByRole("button", { name: "Открыть: Верёвка" });
    expect(open.textContent).toBe("Верёвка");
  });
});
