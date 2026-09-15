// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import type { ItemView } from "@/contract/views";
import { itemDefinitionOf, type ItemDefinition } from "@/core/domain/items/schema";
import { createWizard, withoutItems } from "@/core/infrastructure/catalog/thorne/fixtures";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";

import { ItemPage, type ItemPatch } from "./ItemPage";

const spells = loadThorneSpells();

afterEach(cleanup);

const choices = toChoicesView();

const ring: ItemDefinition = {
  id: "ring",
  nameRu: "Кольцо защиты",
  notes: [],
  kinds: ["gear"],
  bonuses: { armorClass: 1 },
};

function viewOf(definition: ItemDefinition, bag = 1, worn = 0): ItemView {
  const state = withoutItems(createWizard());
  const found = toBagView(
    {
      ...state,
      itemDefinitions: [definition],
      equipment: {
        ...state.equipment,
        bag: [{ itemId: definition.id, count: bag }],
        worn: [{ itemId: definition.id, count: worn }],
      },
    },
    spells,
  ).items.find((item) => item.id === definition.id);
  if (found === undefined) throw new Error(`нет вещи ${definition.id}`);
  return found;
}

function renderPage(item: ItemView, onWrite: (patch: ItemPatch) => void = () => {}) {
  return render(
    <ItemPage
      item={item}
      choices={choices}
      ingredient={undefined}
      backTitleRu="Рюкзак"
      onBack={() => {}}
      onWrite={onWrite}
      onToggleWanted={() => {}}
      onAdjustBagCount={() => {}}
      onAdjustWornCount={() => {}}
      onAddNote={() => {}}
      onRewriteNote={() => {}}
      onDropNote={() => {}}
      onRemove={() => {}}
      onOpenAlchemy={() => {}}
      onStartAlchemy={() => {}}
    />,
  );
}

/** Правка доезжает до вещи и возвращается на страницу — как в приложении, а не в пустоту. */
function Editable({ start }: { start: ItemDefinition }) {
  const [definition, setDefinition] = useState(start);

  return (
    <ItemPage
      item={viewOf(definition)}
      choices={choices}
      ingredient={undefined}
      backTitleRu="Рюкзак"
      onBack={() => {}}
      onWrite={(patch) => setDefinition(itemDefinitionOf({ ...patch, notes: definition.notes }))}
      onToggleWanted={() => {}}
      onAdjustBagCount={() => {}}
      onAdjustWornCount={() => {}}
      onAddNote={() => {}}
      onRewriteNote={() => {}}
      onDropNote={() => {}}
      onRemove={() => {}}
      onOpenAlchemy={() => {}}
      onStartAlchemy={() => {}}
    />
  );
}

describe("карточка вещи", () => {
  it("правку записывают ответом, а не вводом: общего «Сохранить» у карточки нет", async () => {
    const user = userEvent.setup();
    const onWrite = vi.fn();
    renderPage(viewOf(ring), onWrite);

    await user.click(screen.getByRole("button", { name: /Название/ }));
    const name = screen.getByLabelText("Название");
    await user.clear(name);
    await user.type(name, "Кольцо бабушки");
    expect(onWrite).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Отмена" }));
    expect(onWrite).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Название/ }));
    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Кольцо бабушки{Enter}");

    expect(onWrite).toHaveBeenCalledWith(expect.objectContaining({ nameRu: "Кольцо бабушки" }));
    expect(screen.queryByRole("button", { name: "Сохранить" })).toBeNull();
  });

  it("признак ставится и снимается нажатием, а не выбором одного из", async () => {
    const user = userEvent.setup();
    const onWrite = vi.fn();
    renderPage(viewOf(ring), onWrite);

    /* Снятая экипировка оставляет прибавку действовать при себе, а не отменяет её. */
    await user.click(screen.getByRole("button", { name: "Экипировка" }));
    expect(onWrite).toHaveBeenCalledWith(
      expect.objectContaining({ kinds: [], worksCarried: true }),
    );

    renderPage(viewOf({ ...ring, kinds: [], worksCarried: true }), onWrite);
    await user.click(screen.getAllByRole("button", { name: "Экипировка" })[1]!);
    expect(onWrite).toHaveBeenCalledWith(expect.objectContaining({ kinds: ["gear"] }));
  });

  it("прибавку выбирают из величин листа и крутят числом", async () => {
    const user = userEvent.setup();
    const onWrite = vi.fn();
    renderPage(viewOf(ring), onWrite);

    await user.click(screen.getByRole("button", { name: "Класс Доспеха: больше" }));
    expect(onWrite).toHaveBeenCalledWith(
      expect.objectContaining({ bonuses: expect.objectContaining({ armorClass: 2 }) }),
    );

    await user.click(screen.getByRole("button", { name: "Добавить прибавку" }));
    await user.click(screen.getByRole("button", { name: /Инициатива/ }));
    expect(screen.getByRole("button", { name: "Инициатива: больше" })).toBeDefined();
  });

  it("прибавка остаётся на своём месте и от нажатия, и от нуля", async () => {
    const user = userEvent.setup();
    const boots: ItemDefinition = {
      id: "boots",
      nameRu: "Сапоги",
      notes: [],
      kinds: ["gear"],
      bonuses: { "skill:acrobatics": 1 },
    };
    render(<Editable start={boots} />);

    await user.click(screen.getByRole("button", { name: "Добавить прибавку" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "К чему прибавка" })).getByRole("button", {
        name: /^Класс Доспеха/,
      }),
    );

    const order = () =>
      screen
        .getAllByRole("button", { name: /: больше$/ })
        .map((button) => button.getAttribute("aria-label"));

    expect(order()).toEqual(["Акробатика: больше", "Класс Доспеха: больше"]);

    await user.click(screen.getByRole("button", { name: "Класс Доспеха: больше" }));
    expect(order()).toEqual(["Акробатика: больше", "Класс Доспеха: больше"]);

    await user.click(screen.getByRole("button", { name: "Акробатика: меньше" }));
    expect(order()).toEqual(["Акробатика: больше", "Класс Доспеха: больше"]);
  });

  it("цена набирается по номиналам разом: и золото, и медь одной записью", async () => {
    const user = userEvent.setup();
    render(<Editable start={ring} />);

    await user.click(screen.getByRole("button", { name: /Цена за одну штуку/ }));
    await user.clear(screen.getByLabelText("зм"));
    await user.type(screen.getByLabelText("зм"), "1");
    await user.clear(screen.getByLabelText("мм"));
    await user.type(screen.getByLabelText("мм"), "3");
    await user.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByRole("button", { name: /Цена за одну штуку/ }).textContent).toContain(
      "1 зм · 3 мм",
    );
  });

  it("«Убрать вещь» ждёт, пока от вещи не останется ни следа", () => {
    const { rerender } = renderPage(viewOf(ring, 1));
    expect(screen.getByRole("button", { name: "Убрать вещь: Кольцо защиты" })).toHaveProperty(
      "disabled",
      true,
    );

    rerender(
      <ItemPage
        item={viewOf(ring, 0)}
        choices={choices}
        ingredient={undefined}
        backTitleRu="Рюкзак"
        onBack={() => {}}
        onWrite={() => {}}
        onToggleWanted={() => {}}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
        onAddNote={() => {}}
        onRewriteNote={() => {}}
        onDropNote={() => {}}
        onRemove={() => {}}
        onOpenAlchemy={() => {}}
        onStartAlchemy={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Убрать вещь: Кольцо защиты" })).toHaveProperty(
      "disabled",
      false,
    );
  });

  it("надетое считают только у экипировки и не больше, чем лежит в сумке", () => {
    renderPage(viewOf(ring, 0, 1));

    expect(screen.getByRole("button", { name: "Надеть один: Кольцо защиты" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "Снять один: Кольцо защиты" })).toHaveProperty(
      "disabled",
      false,
    );
  });
});
