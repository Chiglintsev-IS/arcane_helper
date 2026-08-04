// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ItemSheet } from "./ItemSheet";

afterEach(cleanup);

describe("шторка вещи", () => {
  it("вещь: категория, заметка и цена дописываются к уже заведённой вещи (FR-235)", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet
        item={{ id: "свиток", nameRu: "Свиток огненного шара", kind: "other", worn: false, count: 1 }}
        onSave={onSave}
        onAdjustCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: "Расходник" }));
    await userEvent.type(screen.getByLabelText("Заметка"), "3 уровень, КС 15");
    await userEvent.type(screen.getByLabelText("Цена"), "150");
    await userEvent.click(screen.getByRole("radio", { name: "Монета: зм" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({
      id: "свиток",
      nameRu: "Свиток огненного шара",
      kind: "consumable",
      worn: false,
      count: 1,
      price: { amount: 150, currency: "gold" },
      note: "3 уровень, КС 15",
      // Набранное уходит как есть, включая нули: что из этого хранить, решает владелец.
      bonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
    });
  });

  it("вещь: прибавки видны только у экипировки, набранное уходит владельцу как есть (FR-238)", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet
        item={{
          id: "кольцо",
          nameRu: "Кольцо защиты",
          kind: "gear",
          worn: true,
          count: 1,
          bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
        }}
        onSave={onSave}
        onAdjustCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByLabelText("К защите")).toBeDefined();

    await userEvent.click(screen.getByRole("radio", { name: "Другое" }));
    // Поля прибавок ушли вместе с категорией: зелье действует, когда его пьют, а не когда несут.
    expect(screen.queryByLabelText("К защите")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    // Надетость и прибавки уходят набранными: снимает их владелец, а не шторка.
    expect(onSave).toHaveBeenCalledWith({
      id: "кольцо",
      nameRu: "Кольцо защиты",
      kind: "other",
      worn: true,
      count: 1,
      bonuses: { spellcasting: 0, armorClass: 1, savingThrows: 1 },
    });
  });

  it("вещь: счёт полем не правится — он живёт расходом и пополнением на строке (FR-241)", () => {
    render(
      <ItemSheet
        item={{ id: "зелье", nameRu: "Зелье лечения", kind: "consumable", worn: false, count: 2 }}
        onSave={() => {}}
        onAdjustCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    // Поля нет вовсе: набранное до расхода число вернуло бы потраченный экземпляр обратно.
    expect(screen.queryByLabelText("Количество")).toBeNull();
    // Запас при этом виден: он стоит в заголовке шторки.
    expect(screen.getByRole("dialog", { name: "Правка: Зелье лечения ×2" })).toBeDefined();
  });

  it("вещь: пустая цена — вещь без цены, а не цена ноль", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet
        item={{
          id: "зелье",
          nameRu: "Зелье лечения",
          kind: "consumable",
          worn: false,
          count: 1,
          price: { amount: 50, currency: "gold" },
        }}
        onSave={onSave}
        onAdjustCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.clear(screen.getByLabelText("Цена"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({
      id: "зелье",
      nameRu: "Зелье лечения",
      kind: "consumable",
      worn: false,
      count: 1,
      bonuses: { spellcasting: 0, armorClass: 0, savingThrows: 0 },
    });
  });

  it("вещь: дробная цена уходит владельцу — отказывает он", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet
        item={{ id: "зелье", nameRu: "Зелье лечения", kind: "consumable", worn: false, count: 1 }}
        onSave={onSave}
        onAdjustCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText("Цена"), "1.5");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // Дробную цену отвергает снаряжение: шторка передаёт набранное как есть.
    expect(onSave.mock.calls[0]?.[0].price).toEqual({ amount: 1.5, currency: "gold" });
  });

  it("вещь: пустое поле прибавки уходит владельцу — отказывает он", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet
        item={{ id: "шлем", nameRu: "Шлем", kind: "gear", worn: false, count: 1 }}
        onSave={onSave}
        onAdjustCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.clear(screen.getByLabelText("К защите"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].bonuses.armorClass).toBeNaN();
  });

  it("вещь: удаление стоит в её же шторке (FR-241)", async () => {
    const onRemove = vi.fn();
    render(
      <ItemSheet
        item={{ id: "зелье", nameRu: "Зелье лечения", kind: "consumable", worn: false, count: 2 }}
        onSave={() => {}}
        onAdjustCount={() => {}}
        onRemove={onRemove}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Убрать: Зелье лечения" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("вещь: запас меняется кнопками в шторке — единственный способ уменьшить стопку экипировки", async () => {
    const onAdjustCount = vi.fn();
    render(
      <ItemSheet
        item={{ id: "кинжал", nameRu: "Кинжал", kind: "gear", worn: false, count: 2 }}
        onSave={() => {}}
        onAdjustCount={onAdjustCount}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Потратить один: Кинжал" }));
    await userEvent.click(screen.getByRole("button", { name: "Добавить один: Кинжал" }));
    expect(onAdjustCount).toHaveBeenNthCalledWith(1, -1);
    expect(onAdjustCount).toHaveBeenNthCalledWith(2, 1);
  });

  it("вещь: расход в шторке выключен на нуле — ноль состояние, а не отсутствие", () => {
    render(
      <ItemSheet
        item={{ id: "зелье", nameRu: "Зелье", kind: "consumable", worn: false, count: 0 }}
        onSave={() => {}}
        onAdjustCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Потратить один: Зелье" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
