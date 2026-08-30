// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ItemView } from "@/contract/views";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { ItemSheet } from "./ItemSheet";

afterEach(cleanup);

type Handlers = {
  onSave?: (item: unknown) => void;
  onToggleWanted?: () => void;
  onAdjustBagCount?: (delta: number) => void;
  onAdjustWornCount?: (delta: number) => void;
  onRemove?: () => void;
};

function itemOf(item: Partial<ItemView> & Pick<ItemView, "id" | "nameRu">): ItemView {
  return {
    kinds: [],
    bagCount: 1,
    wornCount: 0,
    wanted: false,
    worksCarried: false,
    spellcastingFocus: false,
    neededForRu: [],
    bonuses: [],
    bonusFacts: [],
    ...item,
  };
}

function open(item: ItemView, handlers: Handlers = {}) {
  render(
    <ItemSheet
      choices={toChoicesView()}
      item={item}
      onSave={handlers.onSave ?? (() => {})}
      onToggleWanted={handlers.onToggleWanted ?? (() => {})}
      onAdjustBagCount={handlers.onAdjustBagCount ?? (() => {})}
      onAdjustWornCount={handlers.onAdjustWornCount ?? (() => {})}
      onRemove={handlers.onRemove ?? (() => {})}
      onCancel={() => {}}
    />,
  );
}

const scroll = itemOf({ id: "свиток", nameRu: "Свиток огненного шара" });

const ring = itemOf({
  id: "кольцо",
  nameRu: "Кольцо защиты",
  kinds: ["gear"],
  bagCount: 0,
  wornCount: 1,
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
});

describe("шторка вещи", () => {
  it("признаки ставятся вместе: одна вещь бывает и расходником, и ингредиентом", async () => {
    const onSave = vi.fn();
    open(scroll, { onSave });

    expect(screen.getByText("Другое: пока неизвестно, что это")).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: "Расходник" }));
    await userEvent.click(screen.getByRole("button", { name: "Ингредиент" }));
    await userEvent.type(screen.getByLabelText("Заметка"), "3 уровень, КС 15");
    await userEvent.type(screen.getByLabelText("Цена"), "150");
    await userEvent.click(screen.getByRole("radio", { name: "Монета: зм" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({
      id: "свиток",
      nameRu: "Свиток огненного шара",
      kinds: ["consumable", "ingredient"],
      price: { amount: 150, currency: "gold" },
      note: "3 уровень, КС 15",
      bonuses: {},
    });
  });

  it("снятый признак снимается второй раз нажатием", async () => {
    const onSave = vi.fn();
    open(itemOf({ id: "мешок", nameRu: "Мешок", kinds: ["consumable"] }), { onSave });

    await userEvent.click(screen.getByRole("button", { name: "Расходник" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({
      id: "мешок",
      nameRu: "Мешок",
      kinds: [],
      bonuses: {},
    });
  });

  it("«Хочу купить» — отметка снаряжения: она ставится сразу, а не сохранением", async () => {
    const onToggleWanted = vi.fn();
    const onSave = vi.fn();
    open(scroll, { onToggleWanted, onSave });

    await userEvent.click(screen.getByRole("button", { name: "Хочу купить" }));
    expect(onToggleWanted).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("фокусировка — такой же признак, и вещь с ней надевают", async () => {
    const onSave = vi.fn();
    open(itemOf({ id: "жезл", nameRu: "Жезл", kinds: [] }), { onSave });

    await userEvent.click(screen.getByRole("button", { name: "Фокусировка" }));
    expect(screen.getByRole("button", { name: "Экипировка" })).toHaveProperty(
      "ariaPressed",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(onSave).toHaveBeenCalledWith({
      id: "жезл",
      nameRu: "Жезл",
      kinds: ["gear"],
      bonuses: {},
      spellcastingFocus: true,
    });
  });

  it("защиту вещи двигают такой же прибавкой, как всё прочее", async () => {
    const onSave = vi.fn();
    open(itemOf({ id: "наручи", nameRu: "Наручи защиты", kinds: ["gear"] }), { onSave });

    await userEvent.click(screen.getByRole("button", { name: "Добавить прибавку" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "К чему прибавка" })).getByRole("button", {
        name: /^Класс Доспеха/,
      }),
    );
    await userEvent.type(screen.getByLabelText("Класс Доспеха"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].bonuses).toEqual({ armorClass: 2 });
  });

  it("прибавки остаются у вещи, потерявшей экипировку: она называет, что действует при себе", async () => {
    const onSave = vi.fn();
    open(ring, { onSave });

    await userEvent.click(screen.getByRole("button", { name: "Экипировка" }));
    await userEvent.click(screen.getByRole("radio", { name: "при себе" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({
      id: "кольцо",
      nameRu: "Кольцо защиты",
      kinds: [],
      bonuses: { armorClass: 1, "save:constitution": 1 },
      worksCarried: true,
    });
  });

  it("у вещи, которую не надевают, условие сразу стоит на «при себе»", async () => {
    const onSave = vi.fn();
    open(itemOf({ id: "камень", nameRu: "Камень удачи" }), { onSave });

    await userEvent.click(screen.getByRole("button", { name: "Добавить прибавку" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "К чему прибавка" })).getByRole("button", {
        name: /^Инициатива/,
      }),
    );
    expect(screen.getByRole("radio", { name: "при себе" })).toHaveProperty("ariaChecked", "true");

    await userEvent.type(screen.getByLabelText("Инициатива"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ worksCarried: true });
  });

  it("величину прибавки выбирают в своей шторке: группами и поиском", async () => {
    const onSave = vi.fn();
    open(itemOf({ id: "шлем", nameRu: "Шлем", kinds: ["gear"] }), { onSave });

    await userEvent.click(screen.getByRole("button", { name: "Добавить прибавку" }));
    const picker = screen.getByRole("dialog", { name: "К чему прибавка" });
    expect(within(picker).getByRole("heading", { name: "Навыки" })).toBeDefined();

    await userEvent.type(within(picker).getByLabelText("Поиск"), "скрыт");
    expect(within(picker).queryByRole("button", { name: "Акробатика" })).toBeNull();
    await userEvent.click(within(picker).getByRole("button", { name: "Скрытность" }));

    await userEvent.type(screen.getByLabelText("Скрытность"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].bonuses).toEqual({ "skill:stealth": 2 });
  });

  it("«Все спасброски» ставит шесть прибавок разом: плащ защиты набирается одним нажатием", async () => {
    const onSave = vi.fn();
    open(itemOf({ id: "плащ", nameRu: "Плащ защиты", kinds: ["gear"] }), { onSave });

    await userEvent.click(screen.getByRole("button", { name: "Добавить прибавку" }));
    await userEvent.click(screen.getByRole("button", { name: "Все спасброски" }));

    for (const ability of ["Сила", "Ловкость", "Телосложение", "Интеллект", "Мудрость", "Харизма"]) {
      await userEvent.type(screen.getByLabelText(`Спасбросок: ${ability}`), "1");
    }
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].bonuses).toEqual({
      "save:strength": 1,
      "save:dexterity": 1,
      "save:constitution": 1,
      "save:intelligence": 1,
      "save:wisdom": 1,
      "save:charisma": 1,
    });
  });

  it("взятая величина остаётся на виду и говорит, что она уже есть", async () => {
    open(ring);

    await userEvent.click(screen.getByRole("button", { name: "Добавить прибавку" }));
    const picker = screen.getByRole("dialog", { name: "К чему прибавка" });
    expect(within(picker).getByRole("button", { name: "Класс Доспеха: уже есть" })).toBeDefined();
    expect(within(picker).getByRole("button", { name: /^Инициатива/ })).toBeDefined();
  });

  it("величина объясняет себя словом: имя правил само за себя не говорит", async () => {
    open(ring);

    await userEvent.click(screen.getByRole("button", { name: "Добавить прибавку" }));
    const picker = screen.getByRole("dialog", { name: "К чему прибавка" });

    expect(
      within(picker).getByRole("button", { name: /Сложность спасброска врага/ }).textContent,
    ).toContain("врагу труднее спастись");
    expect(
      within(picker).getByRole("button", { name: /Попадание заклинанием/ }).textContent,
    ).toContain("урона не трогает");
  });

  it("пустая прибавка не уходит владельцу и отказывает у поля", async () => {
    const onSave = vi.fn();
    open(itemOf({ id: "шлем", nameRu: "Шлем", kinds: ["gear"] }), { onSave });

    await userEvent.click(screen.getByRole("button", { name: "Добавить прибавку" }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "К чему прибавка" })).getByRole("button", {
        name: /^Класс Доспеха/,
      }),
    );
    const bonus = screen.getByLabelText("Класс Доспеха");
    await userEvent.clear(bonus);
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).not.toHaveBeenCalled();
    const reason = screen.getByRole("alert");
    expect(reason.textContent).toBe("Наберите число");
    expect(bonus.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"));

    await userEvent.type(bonus, "1");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("пустая цена — вещь без цены, а не цена ноль; дробная уходит владельцу как есть", async () => {
    const onSave = vi.fn();
    open(
      itemOf({
        id: "зелье",
        nameRu: "Зелье лечения",
        kinds: ["consumable"],
        price: { amount: 50, currency: "gold" },
      }),
      { onSave },
    );

    await userEvent.clear(screen.getByLabelText("Цена"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(onSave).toHaveBeenCalledWith({
      id: "зелье",
      nameRu: "Зелье лечения",
      kinds: ["consumable"],
      bonuses: {},
    });

    await userEvent.type(screen.getByLabelText("Цена"), "1.5");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(onSave.mock.calls[1]?.[0].price).toEqual({ amount: 1.5, currency: "gold" });
  });

  it("запас и надетое правятся кнопками шторки, поля количества нет", async () => {
    const onAdjustBagCount = vi.fn();
    const onAdjustWornCount = vi.fn();
    open(itemOf({ id: "кинжал", nameRu: "Кинжал", kinds: ["gear"], bagCount: 2 }), {
      onAdjustBagCount,
      onAdjustWornCount,
    });

    expect(screen.queryByLabelText("Количество")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Потратить один из сумки: Кинжал" }));
    await userEvent.click(screen.getByRole("button", { name: "Надеть один: Кинжал" }));

    expect(onAdjustBagCount).toHaveBeenCalledWith(-1);
    expect(onAdjustWornCount).toHaveBeenCalledWith(1);
  });

  it("надетое считают только у экипировки", () => {
    open(itemOf({ id: "зелье", nameRu: "Зелье лечения", kinds: ["consumable"] }));
    expect(screen.queryByRole("button", { name: "Надеть один: Зелье лечения" })).toBeNull();
  });

  it("удаление стоит в её же шторке, включено только при пустом запасе", async () => {
    const onRemove = vi.fn();
    open(itemOf({ id: "зелье", nameRu: "Зелье лечения", bagCount: 0 }), { onRemove });

    await userEvent.click(screen.getByRole("button", { name: "Убрать: Зелье лечения" }));
    expect(onRemove).toHaveBeenCalled();

    cleanup();
    open(itemOf({ id: "зелье", nameRu: "Зелье лечения", bagCount: 2 }));
    expect(screen.getByRole("button", { name: "Убрать: Зелье лечения" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
