// @vitest-environment jsdom

/**
 * Панель режимов сама по себе: чем она отмечает показанное, отвечает она, а не оболочка.
 *
 * Стилей в тестовом DOM нет, и отметку видно классом — зато главное в отметке слово, и его видно
 * так же, как его увидит игрок и как его прочитает вслух программа чтения с экрана.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { BottomNav } from "./BottomNav";

afterEach(cleanup);

/** Раскрытый список при показанном режиме. */
async function openModes(mode: "crafting" | "play"): Promise<HTMLElement> {
  const user = userEvent.setup();
  render(<BottomNav mode={mode} onChange={() => undefined} />);
  await user.click(screen.getByRole("button", { name: /Режимы$/ }));
  return screen.getByRole("dialog", { name: "Режимы" });
}

describe("панель режимов отмечает показанное (FR-200)", () => {
  it("раскрытый список отмечает показанный режим", async () => {
    const list = within(await openModes("crafting"));
    const shown = list.getByRole("button", { name: /^Ремесло/ });
    const other = list.getByRole("button", { name: /^Лист/ });

    // Показанное названо и читающей вслух программе: цвет ей не виден.
    expect(shown.getAttribute("aria-current")).toBe("page");
    expect(other.getAttribute("aria-current")).toBeNull();

    // И названо словом: линейка и акцент читаются глазами, но не произносятся.
    expect(shown.textContent).toContain("сейчас");
    expect(other.textContent).not.toContain("сейчас");
  });

  it("панель называет показанный режим и раскрывается восемью строками (FR-204)", async () => {
    const list = within(await openModes("play"));

    // Все восемь стоят одинаково: второго этажа у навигации нет. Порядок — частота: частое поднято
    // к пальцу, «Лог» стоит последним — его открывают редко и целенаправленно.
    const titles = ["Игра", "Заметки", "Книга", "Лист", "Вещи", "Ремесло", "Привал", "Лог"];
    const rows = list.getAllByRole("button").filter((row) => row.textContent !== "Закрыть");

    expect(rows).toHaveLength(titles.length);
    rows.forEach((row, index) => {
      expect(row.textContent?.startsWith(titles[index]!)).toBe(true);
    });
  });

  it("закрытая панель называет показанный режим и его подпись", () => {
    render(<BottomNav mode="notes" onChange={() => undefined} />);

    const panel = within(screen.getByRole("navigation", { name: "Режим экрана" }));
    const button = panel.getByRole("button", { name: /Режимы$/ });

    // Панель отвечает, где игрок сейчас, не раскрываясь: раскрытие — уже вопрос «куда дальше».
    expect(button.textContent).toContain("Заметки");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("уход из списка режима не меняет", async () => {
    const user = userEvent.setup();
    let picked: string | null = null;
    render(<BottomNav mode="play" onChange={(value) => (picked = value)} />);

    await user.click(screen.getByRole("button", { name: /Режимы$/ }));
    await user.click(within(screen.getByRole("dialog", { name: "Режимы" })).getByRole("button", { name: "Закрыть" }));

    expect(picked).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Режимы" })).toBeNull();
  });
});
