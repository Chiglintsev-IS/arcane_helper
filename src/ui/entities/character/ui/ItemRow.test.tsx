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

function renderRow(definition: ItemDefinition, countRu?: string) {
  return render(
    <ul>
      <ItemRow
        item={viewOf(definition)}
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
    renderRow(staff, "надето 1");

    // Число живёт в той же кнопке, что имя: подробностям под ними остаётся вся ширина строки.
    const open = screen.getByRole("button", { name: "Открыть: Посох силы" });
    expect(within(open).getByText("надето 1")).toBeDefined();
  });

  it("факт — своя плашка: имя величины при своём числе, перенос между фактами (FR-250)", () => {
    renderRow(staff);

    // Плашка целиком держит имя величины и её число: неделимость — свойство элемента.
    expect(screen.getByText("КС спасброска").textContent).toBe("КС спасброска +2");
    expect(screen.getByText("Атака заклинанием").textContent).toBe("Атака заклинанием +2");

    // Заметка — свободный текст после фактов, а не плашка.
    expect(screen.getByText("требует настройки")).toBeDefined();
  });

  it("фактов сверх видимых — «ещё N», а не молчаливый обрыв (FR-250)", () => {
    renderRow({
      id: "cloak-of-everything",
      nameRu: "Плащ всего",
      kind: "gear",
      bonuses: {
        armorClass: 1,
        "save:strength": 1,
        "save:dexterity": 1,
        "save:constitution": 1,
        "save:intelligence": 1,
        "save:wisdom": 1,
        "save:charisma": 1,
      },
    });

    expect(screen.getByText("Класс Доспеха")).toBeDefined();
    expect(screen.getByText("Спасбросок: Сила")).toBeDefined();
    expect(screen.getByText("Спасбросок: Ловкость")).toBeDefined();
    expect(screen.queryByText("Спасбросок: Телосложение")).toBeNull();
    expect(screen.getByText("ещё 4")).toBeDefined();
  });

  it("четыре факта видны все: за «ещё» не прячется единственный (FR-250)", () => {
    renderRow({
      id: "bracers-of-defense",
      nameRu: "Наручи защиты",
      kind: "gear",
      bonuses: {
        armorClass: 1,
        "save:strength": 1,
        "save:dexterity": 1,
        "save:constitution": 1,
      },
    });

    expect(screen.getByText("Спасбросок: Телосложение")).toBeDefined();
    expect(screen.queryByText(/^ещё/)).toBeNull();
  });

  it("у вещи без подробностей второй строки нет вовсе (FR-250)", () => {
    renderRow({ id: "rope", nameRu: "Верёвка", kind: "other" });

    const open = screen.getByRole("button", { name: "Открыть: Верёвка" });
    expect(open.textContent).toBe("Верёвка");
  });
});
