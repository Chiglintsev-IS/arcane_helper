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

  it("факт второй строки — неделимый элемент: перенос идёт между фактами (FR-250)", () => {
    renderRow(staff);

    // Точное совпадение находит факт только тогда, когда он стоит собственным элементом,
    // а не куском общей фразы: неделимость — свойство элемента.
    expect(screen.getByText("КС спасброска +2")).toBeDefined();
    expect(screen.getByText("Атака заклинанием +2")).toBeDefined();

    // Заметка — свободный текст после фактов, с тем же разделителем.
    const open = screen.getByRole("button", { name: "Открыть: Посох силы" });
    expect(open.textContent).toContain("Атака заклинанием +2 · требует настройки");
  });

  it("у вещи без подробностей второй строки нет вовсе (FR-250)", () => {
    renderRow({ id: "rope", nameRu: "Верёвка", kind: "other" });

    const open = screen.getByRole("button", { name: "Открыть: Верёвка" });
    expect(open.textContent).toBe("Верёвка");
  });
});
