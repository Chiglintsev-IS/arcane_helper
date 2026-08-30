// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { BottomNav } from "./BottomNav";

afterEach(cleanup);

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

    expect(shown.getAttribute("aria-current")).toBe("page");
    expect(other.getAttribute("aria-current")).toBeNull();

    expect(shown.textContent).toContain("сейчас");
    expect(other.textContent).not.toContain("сейчас");
  });

  it("панель называет показанный режим и раскрывается восемью строками (FR-204)", async () => {
    const list = within(await openModes("play"));

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
