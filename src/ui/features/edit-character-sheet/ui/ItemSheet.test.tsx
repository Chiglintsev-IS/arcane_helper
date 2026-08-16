// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { toChoicesView } from "@/core/presentation/views/choicesView";
import { ItemSheet } from "./ItemSheet";

afterEach(cleanup);

describe("шторка вещи", () => {
  it("вещь: категория, заметка и цена дописываются к уже заведённой вещи (FR-235)", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "свиток",
          nameRu: "Свиток огненного шара",
          kind: "other",
          bagCount: 1,
          wornCount: 0,
          spellcastingFocus: false,
          neededForRu: [],
          bonuses: [],
          bonusFacts: [],
        }}
        onSave={onSave}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
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
      price: { amount: 150, currency: "gold" },
      note: "3 уровень, КС 15",
      // Набранное уходит как есть, включая нули: что из этого хранить, решает владелец.
      bonuses: {},
    });
  });

  it("вещь: прибавки видны только у экипировки, набранное уходит владельцу как есть (FR-238)", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "кольцо",
          nameRu: "Кольцо защиты",
          kind: "gear",
          bonuses: [
            { stat: "armorClass", value: 1 },
            { stat: "save:constitution", value: 1 },
          ],
          bonusFacts: [
            {
              value: 1,
              targets: [
                { kind: "stat", id: "armorClass" },
                { kind: "stat", id: "save:constitution" },
              ],
            },
          ],
          bagCount: 0,
          wornCount: 1,
          spellcastingFocus: false,
          neededForRu: [],
        }}
        onSave={onSave}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    // Прибавки набраны по одной на величину, и каждая названа своим словом.
    expect(screen.getByLabelText("Класс Доспеха")).toBeDefined();
    expect(screen.getByLabelText("Спасбросок: Телосложение")).toBeDefined();

    await userEvent.click(screen.getByRole("radio", { name: "Другое" }));
    // Поля прибавок ушли вместе с категорией: зелье действует, когда его пьют, а не когда несут.
    expect(screen.queryByLabelText("Класс Доспеха")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    // Прибавки уходят набранными: снимает их владелец, а не шторка.
    expect(onSave).toHaveBeenCalledWith({
      id: "кольцо",
      nameRu: "Кольцо защиты",
      kind: "other",
      bonuses: { armorClass: 1, "save:constitution": 1 },
    });
  });

  it("вещь: запас полем не правится — он живёт расходом и пополнением на строке (FR-241)", () => {
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "зелье",
          nameRu: "Зелье лечения",
          kind: "consumable",
          bagCount: 2,
          wornCount: 0,
          spellcastingFocus: false,
          neededForRu: [],
          bonuses: [],
          bonusFacts: [],
        }}
        onSave={() => {}}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    // Поля нет вовсе: набранное до расхода число вернуло бы потраченный экземпляр обратно.
    expect(screen.queryByLabelText("Количество")).toBeNull();
    // Заголовок шторки числа не называет: запас виден строкой «В сумке» рядом со счётчиком.
    expect(screen.getByRole("dialog", { name: "Правка: Зелье лечения" })).toBeDefined();
  });

  it("вещь: пустая цена — вещь без цены, а не цена ноль", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "зелье",
          nameRu: "Зелье лечения",
          kind: "consumable",
          price: { amount: 50, currency: "gold" },
          bagCount: 1,
          wornCount: 0,
          spellcastingFocus: false,
          neededForRu: [],
          bonuses: [],
          bonusFacts: [],
        }}
        onSave={onSave}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
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
      bonuses: {},
    });
  });

  it("вещь: дробная цена уходит владельцу — отказывает он", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "зелье",
          nameRu: "Зелье лечения",
          kind: "consumable",
          bagCount: 1,
          wornCount: 0,
          spellcastingFocus: false,
          neededForRu: [],
          bonuses: [],
          bonusFacts: [],
        }}
        onSave={onSave}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText("Цена"), "1.5");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // Дробную цену отвергает снаряжение: шторка передаёт набранное как есть.
    expect(onSave.mock.calls[0]?.[0].price).toEqual({ amount: 1.5, currency: "gold" });
  });

  it("вещь: пустая прибавка не уходит владельцу и отказывает у поля", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "шлем",
          nameRu: "Шлем",
          kind: "gear",
          bagCount: 1,
          wornCount: 0,
          spellcastingFocus: false,
          neededForRu: [],
          bonuses: [],
          bonusFacts: [],
        }}
        onSave={onSave}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Добавить прибавку"), "armorClass");
    await userEvent.click(screen.getByRole("button", { name: "Добавить" }));
    const bonus = screen.getByLabelText("Класс Доспеха");
    await userEvent.clear(bonus);
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // Прибавка без числа — несобранная просьба: пустая цена рядом при этом законна и молчит.
    expect(onSave).not.toHaveBeenCalled();
    const reason = screen.getByRole("alert");
    expect(reason.textContent).toBe("Наберите число");
    expect(bonus.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"));
    expect(screen.getByLabelText("Цена").getAttribute("aria-invalid")).toBe("false");

    await userEvent.type(bonus, "1");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("вещь: пустая прибавка, уехавшая с экрана, не держит сохранение", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "шлем",
          nameRu: "Шлем",
          kind: "gear",
          bonuses: [{ stat: "armorClass", value: 1 }],
          bonusFacts: [{ value: 1, targets: [{ kind: "stat", id: "armorClass" }] }],
          bagCount: 1,
          wornCount: 0,
          spellcastingFocus: false,
          neededForRu: [],
        }}
        onSave={onSave}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.clear(screen.getByLabelText("Класс Доспеха"));
    await userEvent.click(screen.getByRole("radio", { name: "Расходник" }));
    // Поле ушло вместе с прибавками: причине негде было бы встать, и просить о ней не о чем.
    expect(screen.queryByLabelText("Класс Доспеха")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // Нажатие не молчит: просьба собралась без ушедшего поля и ушла владельцу.
    expect(onSave).toHaveBeenCalledWith({
      id: "шлем",
      nameRu: "Шлем",
      kind: "consumable",
      bonuses: {},
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("вещь: удаление стоит в её же шторке, включено только при пустом запасе (FR-241)", async () => {
    const onRemove = vi.fn();
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "зелье",
          nameRu: "Зелье лечения",
          kind: "consumable",
          bagCount: 0,
          wornCount: 0,
          spellcastingFocus: false,
          neededForRu: [],
          bonuses: [],
          bonusFacts: [],
        }}
        onSave={() => {}}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
        onRemove={onRemove}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Убрать: Зелье лечения" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("вещь: удаление выключено, пока в сумке или на теле остаётся запас", () => {
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "зелье",
          nameRu: "Зелье лечения",
          kind: "consumable",
          bagCount: 2,
          wornCount: 0,
          spellcastingFocus: false,
          neededForRu: [],
          bonuses: [],
          bonusFacts: [],
        }}
        onSave={() => {}}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: "Убрать: Зелье лечения" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("вещь: запас в сумке меняется кнопками в шторке — единственный способ уменьшить стопку", async () => {
    const onAdjustBagCount = vi.fn();
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "кинжал",
          nameRu: "Кинжал",
          kind: "gear",
          bagCount: 2,
          wornCount: 0,
          spellcastingFocus: false,
          neededForRu: [],
          bonuses: [],
          bonusFacts: [],
        }}
        onSave={() => {}}
        onAdjustBagCount={onAdjustBagCount}
        onAdjustWornCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Потратить один из сумки: Кинжал" }));
    await userEvent.click(screen.getByRole("button", { name: "Добавить один в сумку: Кинжал" }));
    expect(onAdjustBagCount).toHaveBeenNthCalledWith(1, -1);
    expect(onAdjustBagCount).toHaveBeenNthCalledWith(2, 1);
  });

  it("вещь: расход в шторке выключен на нуле — ноль состояние, а не отсутствие", () => {
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "зелье",
          nameRu: "Зелье",
          kind: "consumable",
          bagCount: 0,
          wornCount: 0,
          spellcastingFocus: false,
          neededForRu: [],
          bonuses: [],
          bonusFacts: [],
        }}
        onSave={() => {}}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Потратить один из сумки: Зелье" })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("вещь: строка «Надето» видна только у экипировки, кнопки надевают и снимают", async () => {
    const onAdjustWornCount = vi.fn();
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "кинжал",
          nameRu: "Кинжал",
          kind: "gear",
          bagCount: 1,
          wornCount: 1,
          spellcastingFocus: false,
          neededForRu: [],
          bonuses: [],
          bonusFacts: [],
        }}
        onSave={() => {}}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={onAdjustWornCount}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Надеть один: Кинжал" }));
    await userEvent.click(screen.getByRole("button", { name: "Снять один: Кинжал" }));
    expect(onAdjustWornCount).toHaveBeenNthCalledWith(1, 1);
    expect(onAdjustWornCount).toHaveBeenNthCalledWith(2, -1);
  });

  it("вещь: у не-экипировки строки «Надето» нет", () => {
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "зелье",
          nameRu: "Зелье",
          kind: "consumable",
          bagCount: 1,
          wornCount: 0,
          spellcastingFocus: false,
          neededForRu: [],
          bonuses: [],
          bonusFacts: [],
        }}
        onSave={() => {}}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText("Надето")).toBeNull();
  });

  it("вещь: экипировку отмечают магической фокусировкой (FR-260)", async () => {
    const onSave = vi.fn();
    render(
      <ItemSheet choices={toChoicesView()}
        item={{
          id: "жезл",
          nameRu: "Рунный жезл",
          kind: "gear",
          bagCount: 0,
          wornCount: 1,
          spellcastingFocus: false,
          neededForRu: [],
          bonuses: [],
          bonusFacts: [],
        }}
        onSave={onSave}
        onAdjustBagCount={() => {}}
        onAdjustWornCount={() => {}}
        onRemove={() => {}}
        onCancel={() => {}}
      />,
    );

    const focus = screen.getByRole("button", { name: "Магическая фокусировка" });
    expect(focus.getAttribute("aria-pressed")).toBe("false");

    await userEvent.click(focus);
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({
      id: "жезл",
      nameRu: "Рунный жезл",
      kind: "gear",
      bonuses: {},
      spellcastingFocus: true,
    });

    // Отметка — свойство экипировки: у расходника её не спрашивают вовсе.
    await userEvent.click(screen.getByRole("radio", { name: "Расходник" }));
    expect(screen.queryByRole("button", { name: "Магическая фокусировка" })).toBeNull();
  });
});
