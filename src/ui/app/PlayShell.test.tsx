// @vitest-environment jsdom

/**
 * Оболочка: переключатель режима, полоса ошибки и выбор режима, переживающий перезапуск.
 *
 * Хранилище режима — настоящее `localStorage` тестового DOM: подмена его моком проверяла бы мок, а
 * ломается здесь именно чтение чужого значения.
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PlayShell } from "@/ui/app/PlayShell";
import { renderWithStores } from "@/ui/app/testing/stores";

const STORAGE_KEY = "playScreenMode";

/** Выбран ли режим: полоса помечает текущий, и это единственный признак на экране. */
function selected(title: string): boolean {
  return screen.getByRole("radio", { name: new RegExp(`^${title}`) }).getAttribute("aria-checked") === "true";
}

describe("режим экрана переживает перезапуск (FR-204)", () => {
  it("открывает сохранённый режим", async () => {
    localStorage.setItem(STORAGE_KEY, "rest");

    await renderWithStores(<PlayShell />);

    expect(selected("Привал")).toBe(true);
  });

  it("переключение запоминается", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayShell />);

    await user.click(screen.getByRole("radio", { name: /^Сумка/ }));

    expect(localStorage.getItem(STORAGE_KEY)).toBe("bag");
  });

  it("битое значение читается как отсутствующее и открывает «Игру»", async () => {
    // Значение приходит из чужих рук: прежняя версия, ручная правка, мусор в хранилище. Раньше
    // оно доходило до разбора режима как есть и не попадало ни в одну ветку — экран не рисовался.
    localStorage.setItem(STORAGE_KEY, "combat");

    await renderWithStores(<PlayShell />);

    expect(selected("Игра")).toBe(true);
    expect(screen.getByLabelText("Ресурсы")).toBeDefined();
  });
});
