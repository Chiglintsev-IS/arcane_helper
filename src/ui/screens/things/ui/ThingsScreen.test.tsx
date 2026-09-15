// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import type { ItemView } from "@/contract/views";
import type { AppStores } from "@/ui/shared/model/storeContext";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { renderWithStores, shown } from "@/ui/app/testing/stores";
import { ThingsScreen } from "@/ui/screens/things/ui/ThingsScreen";

function itemOf(stores: AppStores, id: string): ItemView | undefined {
  return shown(stores).bag.items.find((item) => item.id === id);
}

const TAB_KEY = "thingsPart";

const HERB = "Частичка плода большой гальперы";

afterEach(() => {
  localStorage.clear();
});

describe("«Вещи»", () => {
  it("три закладки, и выбранная переживает перезапуск, а чепуха в памяти — нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<ThingsScreen />, createThorne());

    const tabs = within(screen.getByRole("navigation", { name: "Что показать" }));
    expect(tabs.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Рюкзак",
      "Встречалось",
      "Покупки",
    ]);

    await user.click(tabs.getByRole("button", { name: "Покупки" }));
    expect(localStorage.getItem(TAB_KEY)).toBe("buy");

    localStorage.setItem(TAB_KEY, "чепуха");
    const { container } = await renderWithStores(<ThingsScreen />, createThorne());
    expect(
      within(container).getByRole("button", { name: "Рюкзак" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("записанная вещь сразу встаёт в рюкзак числом в одну штуку и без признаков", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen />, createThorne());

    await user.click(screen.getByRole("button", { name: "Записать вещь" }));
    await user.type(screen.getByLabelText("Название со слов мастера"), "Кольцо защиты{Enter}");

    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ bagCount: 1, kinds: [] });
  });

  it("списание отменяется плашкой, а опустевшая строка остаётся на месте", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen />, createThorne());

    await user.click(screen.getByRole("button", { name: "Записать вещь" }));
    await user.type(screen.getByLabelText("Название со слов мастера"), "Зелье лечения{Enter}");
    await user.click(screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }));

    expect(itemOf(stores, "зелье-лечения")?.bagCount).toBe(0);
    expect(screen.getByText("Списано: Зелье лечения")).toBeDefined();
    expect(screen.getByRole("button", { name: /^Зелье лечения/ }).textContent).toContain("0шт");

    await user.click(screen.getByRole("button", { name: "Вернуть" }));
    expect(itemOf(stores, "зелье-лечения")?.bagCount).toBe(1);
  });

  it("карточка вещи открывается страницей и правит вещь без «Сохранить»", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen />, createThorne());

    const before = shown(stores).bag.armorClass.value;

    await user.click(screen.getByRole("button", { name: "Записать вещь" }));
    await user.type(screen.getByLabelText("Название со слов мастера"), "Кольцо защиты{Enter}");
    await user.click(screen.getByRole("button", { name: /^Кольцо защиты/ }));

    await user.click(screen.getByRole("button", { name: "Экипировка" }));
    await user.click(screen.getByRole("button", { name: "Добавить прибавку" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "К чему прибавка" })).getByRole("button", {
        name: /^Класс Доспеха/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Класс Доспеха: больше" }));
    await user.click(screen.getByRole("button", { name: "Надеть один: Кольцо защиты" }));

    expect(itemOf(stores, "кольцо-защиты")).toMatchObject({ wornCount: 1, bagCount: 0 });
    expect(shown(stores).bag.armorClass.value).toBe(before + 1);

    await user.click(screen.getByRole("button", { name: "Рюкзак" }));
    expect(screen.getByRole("navigation", { name: "Что показать" })).toBeDefined();
  });

  it("свойства ингредиента карточка показывает фактами, а правят их в алхимии", async () => {
    const user = userEvent.setup();
    await renderWithStores(<ThingsScreen />, createThorne());

    await user.click(screen.getByRole("button", { name: new RegExp(`^${HERB}`) }));

    expect(screen.getByText("Алхимия этой вещи")).toBeDefined();
    expect(screen.getByRole("button", { name: "Открыть в алхимии →" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Раскрыть и править свойства" })).toBeNull();
  });

  it("отмеченное к покупке считается деньгами и встаёт в рюкзак купленным", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen initialTab="met" />, createThorne());

    await user.click(screen.getByRole("button", { name: "Записать вещь" }));
    await user.type(screen.getByLabelText("Название со слов мастера"), "Зелье невидимости{Enter}");

    expect(itemOf(stores, "зелье-невидимости")).toMatchObject({ bagCount: 0, wanted: false });

    await user.click(screen.getByRole("button", { name: "в покупки: Зелье невидимости" }));
    expect(itemOf(stores, "зелье-невидимости")?.wanted).toBe(true);

    await user.click(
      within(screen.getByRole("navigation", { name: "Что показать" })).getByRole("button", {
        name: "Покупки",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Купить: Зелье невидимости" }));

    expect(itemOf(stores, "зелье-невидимости")).toMatchObject({ bagCount: 1, wanted: true });
    expect(itemOf(stores, "зелье-невидимости")?.notes.at(-1)?.textRu).toBe(
      "куплено по списку покупок",
    );
    expect(shown(stores).log.at(-1)?.summaryRu).toBe("Куплено: Зелье невидимости (в сумке 1)");
  });

  it("деньги правятся прямо в строке рюкзака", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<ThingsScreen />, createThorne());

    await user.click(screen.getByRole("button", { name: "Деньги" }));
    const gold = screen.getByLabelText("зм");
    await user.clear(gold);
    await user.type(gold, "215");
    await user.click(screen.getByRole("button", { name: "Записать" }));

    expect(shown(stores).bag.money.find((coin) => coin.currency === "gold")?.amount).toBe(215);
    expect(shown(stores).log.at(-1)?.summaryRu).toBe("Деньги: зм 7800 → 215");
  });
});
