// @vitest-environment jsdom

/**
 * Выход из непрочитанного сохранения.
 *
 * Хранилище портится по-настоящему: то же ядро, тот же провод, испорчено только содержимое. Прогон
 * смотрит туда же, куда игрок, — на порядок блоков и на то, что первым под пальцем оказывается не
 * очистка.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import {
  createStoresOverBrokenStorage,
  createStoresOverUnreadableSave,
  renderOn,
} from "@/ui/app/testing/stores";
import type { AppStores } from "@/ui/shared/model/storeContext";

import { UnreadableSave } from "./UnreadableSave";

async function openScreen(
  makeStores: () => Promise<AppStores> = createStoresOverUnreadableSave,
): Promise<AppStores> {
  const { stores } = renderOn(await makeStores(), <UnreadableSave />);
  return stores;
}

/** Порядок блоков на экране: прогон читает документ так же, как палец идёт сверху вниз. */
function positionOf(node: Element): number {
  return [...document.querySelectorAll("h1, h2, button")].indexOf(node);
}

describe("нечитаемое сохранение", () => {
  it("сначала причина, потом копия, и лишь за ней — начать заново", async () => {
    await openScreen();

    expect(screen.getByRole("alert").textContent).toMatch(/повреждено/);

    const copy = screen.getByRole("button", { name: "Скачать файл" });
    const startOver = screen.getByRole("button", { name: "Начать заново" });
    expect(positionOf(copy)).toBeLessThan(positionOf(startOver));

    // Копия — содержимое хранилища как есть: по нему видно, что данные целы.
    expect(screen.getByLabelText("Содержимое хранилища").textContent).toContain("schemaVersion");
  });

  it("копия, которой нет, названа словами", async () => {
    // Хранилище не открылось вовсе: причина есть, копировать нечего, и это два разных факта.
    await openScreen(createStoresOverBrokenStorage);

    expect(screen.getByText(/Копировать нечего/)).toBeDefined();
    expect(screen.queryByRole("button", { name: "Скачать файл" })).toBeNull();
    expect(screen.getByRole("button", { name: "Начать заново" })).toBeDefined();
  });

  it("начать заново спрашивает подтверждение и называет цену", async () => {
    const user = userEvent.setup();
    const stores = await openScreen();

    await user.click(screen.getByRole("button", { name: "Начать заново" }));

    const question = within(screen.getByRole("dialog", { name: "Начать заново?" }));
    expect(question.getByText(/забранной до очистки/)).toBeDefined();

    // До подтверждения состояние остаётся непрочитанным: отказ на экране, снимка нет.
    expect(stores.session.getState().snapshot).toBeNull();

    await user.click(question.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByRole("dialog", { name: "Начать заново?" })).toBeNull();
    expect(stores.session.getState().snapshot).toBeNull();
  });

  it("подтверждённое начало заново открывает чистого Торна", async () => {
    const user = userEvent.setup();
    const stores = await openScreen();

    await user.click(screen.getByRole("button", { name: "Начать заново" }));
    await user.click(screen.getByRole("button", { name: "Удалить и начать" }));

    expect(stores.session.getState().status).toBe("ready");
    expect(stores.session.getState().snapshot?.sheet.name).toBe("Торн");
  });
});
