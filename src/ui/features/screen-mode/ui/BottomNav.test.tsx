// @vitest-environment jsdom

/**
 * Панель режимов сама по себе: чем она отмечает показанное, отвечает она, а не оболочка.
 *
 * Стилей в тестовом DOM нет, и подложка видна только классом — зато сравнивать её можно с той,
 * которой панель отмечает собственную ячейку.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { BottomNav } from "./BottomNav";

afterEach(cleanup);

/** Оттенок выбранного на элементе: подпись красится им же, но отмечает именно подложка. */
function tint(element: Element): string | undefined {
  return [...element.classList].find((name) => name.startsWith("bg-action"));
}

/** Список «Ещё» при показанном режиме из-под него. */
async function openMore(): Promise<HTMLElement> {
  const user = userEvent.setup();
  render(<BottomNav mode="crafting" onChange={() => undefined} />);
  await user.click(screen.getByRole("button", { name: /^Ещё/ }));
  return screen.getByRole("dialog", { name: "Ещё" });
}

describe("панель режимов отмечает показанное (FR-200)", () => {
  it("список «Ещё» отмечает показанный режим", async () => {
    const list = within(await openMore());
    const shown = list.getByRole("button", { name: /^Ремесло/ });
    const other = list.getByRole("button", { name: /^Лист/ });

    // Показанное названо и читающей вслух программе: цвет ей не виден.
    expect(shown.getAttribute("aria-current")).toBe("page");
    expect(other.getAttribute("aria-current")).toBeNull();

    // Отмечено тем же, чем отмечена сама ячейка «Ещё»: два способа отметки читались бы как две
    // разные отметки, а показанный режим один.
    expect(tint(shown)).toBe(tint(screen.getByRole("button", { name: /^Ещё/ })));
    expect(tint(other)).toBeUndefined();
  });
});
