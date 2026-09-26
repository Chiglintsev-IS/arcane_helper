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

import { WRITTEN, type WriteAnswer } from "@/ui/shared/ui/FieldForm";

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

/** Куда ушла правка — нажатием или формой — прогону всё равно: он смотрит, что именно ушло. */
function renderPage(
  item: ItemView,
  onPatch: (patch: ItemPatch) => void = () => {},
  refusalRu: string | null = null,
  answer: () => WriteAnswer = () => WRITTEN,
) {
  return render(
    <ItemPage
      item={item}
      choices={choices}
      ingredient={undefined}
      backTitleRu="Рюкзак"
      refusalRu={refusalRu}
      onBack={() => {}}
      onChange={onPatch}
      onWrite={(patch) => {
        onPatch(patch);
        return answer();
      }}
      onToggleWanted={() => {}}
      onAdjustBagCount={() => {}}
      onAdjustWornCount={() => {}}
      onAddNote={() => WRITTEN}
      onRewriteNote={() => WRITTEN}
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
      refusalRu={null}
      onBack={() => {}}
      onChange={(patch) => setDefinition(itemDefinitionOf({ ...patch, notes: definition.notes }))}
      onWrite={(patch) => {
        setDefinition(itemDefinitionOf({ ...patch, notes: definition.notes }));
        return WRITTEN;
      }}
      onToggleWanted={() => {}}
      onAdjustBagCount={() => {}}
      onAdjustWornCount={() => {}}
      onAddNote={() => WRITTEN}
      onRewriteNote={() => WRITTEN}
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

  it("записанное закрывает форму, а отказ оставляет набранное и причину у поля", async () => {
    const user = userEvent.setup();
    const refusal = "Вещь с таким названием уже записана";
    const answers = [Promise.resolve(refusal), WRITTEN];
    renderPage(viewOf(ring), () => {}, null, () => answers.shift() ?? WRITTEN);

    await user.click(screen.getByRole("button", { name: /Название/ }));
    await user.clear(screen.getByLabelText("Название"));
    await user.type(screen.getByLabelText("Название"), "Кольцо бабушки");
    await user.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByRole("alert").textContent).toBe(refusal);
    expect(screen.getByLabelText<HTMLInputElement>("Название").value).toBe("Кольцо бабушки");

    await user.click(screen.getByRole("button", { name: "Записать" }));
    expect(screen.queryByLabelText("Название")).toBeNull();
  });

  it("признак ставится и снимается нажатием, а не выбором одного из", async () => {
    const user = userEvent.setup();
    const onWrite = vi.fn();
    renderPage(viewOf(ring), onWrite);

    await user.click(screen.getByRole("button", { name: "Экипировка" }));
    expect(onWrite).toHaveBeenCalledWith(expect.objectContaining({ kinds: [] }));

    renderPage(viewOf({ ...ring, kinds: ["trinket"] }), onWrite);
    await user.click(screen.getAllByRole("button", { name: "Экипировка" })[1]!);
    expect(onWrite).toHaveBeenCalledWith(expect.objectContaining({ kinds: ["trinket", "gear"] }));
  });

  it("безделушка ставится и снимается у экипировки в обе стороны", async () => {
    const user = userEvent.setup();
    render(<Editable start={ring} />);
    const pressed = () =>
      screen.getByRole("button", { name: "Безделушка" }).getAttribute("aria-pressed");

    await user.click(screen.getByRole("button", { name: "Безделушка" }));
    expect(pressed()).toBe("true");

    await user.click(screen.getByRole("button", { name: "Безделушка" }));
    expect(pressed()).toBe("false");
  });

  it("отказ ядра виден в самой карточке, а не за её пределами", () => {
    renderPage(viewOf(ring), () => {}, "Вещь «Кольцо защиты» остаётся безделушкой");
    expect(screen.getByRole("alert").textContent).toBe("Вещь «Кольцо защиты» остаётся безделушкой");
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
        refusalRu={null}
        onBack={() => {}}
        onChange={() => {}}
        onWrite={() => WRITTEN}
        onToggleWanted={() => {}}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
        onAddNote={() => WRITTEN}
        onRewriteNote={() => WRITTEN}
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
