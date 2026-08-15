// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

import { ItemRow } from "./ItemRow";

afterEach(cleanup);

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

  it("факт — своя плашка: имя величины при своём числе, перенос между фактами (FR-250)", () => {
    renderRow(viewOf(staff));

    // Плашка целиком держит имя величины и её число: неделимость — свойство элемента.
    expect(screen.getByText("КС спасброска").textContent).toBe("КС спасброска +2");
    expect(screen.getByText("Атака заклинанием").textContent).toBe("Атака заклинанием +2");

    // Заметка — свободный текст после фактов, а не плашка.
    expect(screen.getByText("требует настройки")).toBeDefined();
  });

  it("фактов сверх видимых — «ещё N», а не молчаливый обрыв (FR-250)", () => {
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

    expect(screen.getByText("Класс Доспеха")).toBeDefined();
    expect(screen.getByText("КС спасброска")).toBeDefined();
    expect(screen.getByText("Атака заклинанием")).toBeDefined();
    expect(screen.queryByText("Инициатива")).toBeNull();
    expect(screen.getByText("ещё 2")).toBeDefined();
  });

  it("однородное стоит одним фактом: шесть спасбросков не режутся счётом (FR-250)", () => {
    renderRow(wornOf("cloak-of-protection"));

    // Плащ двигает семь чисел, и все семь на строке названы: КД — своим фактом, спасброски — целым.
    expect(screen.getByText("Класс Доспеха").textContent).toBe("Класс Доспеха +1");
    expect(screen.getByText("Все спасброски").textContent).toBe("Все спасброски +1");
    expect(screen.queryByText(/Спасбросок:/)).toBeNull();
    expect(screen.queryByText(/^ещё/)).toBeNull();
  });

  it("четыре факта видны все: за «ещё» не прячется единственный (FR-250)", () => {
    renderRow(
      viewOf({
        id: "bracers-of-defense",
        nameRu: "Наручи защиты",
        kind: "gear",
        bonuses: {
          armorClass: 1,
          "save:strength": 1,
          "save:dexterity": 1,
          "save:constitution": 1,
        },
      }),
    );

    // Три спасброска из шести — не «все»: неполное семейство остаётся перечнем, и он виден целиком.
    expect(screen.getByText("Спасбросок: Телосложение")).toBeDefined();
    expect(screen.queryByText(/^ещё/)).toBeNull();
  });

  it("у вещи без подробностей второй строки нет вовсе (FR-250)", () => {
    renderRow(viewOf({ id: "rope", nameRu: "Верёвка", kind: "other" }));

    const open = screen.getByRole("button", { name: "Открыть: Верёвка" });
    expect(open.textContent).toBe("Верёвка");
  });
});
