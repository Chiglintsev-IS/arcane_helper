// @vitest-environment jsdom

/**
 * Шторка данных: разделов у неё три, и ни один из них не имя шторки — имя у неё своё.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithStores } from "@/ui/app/testing/stores";
import { DataSheet } from "./DataSheet";

describe("шторка данных называет своё дело (FR-274)", () => {
  it("данные: заголовок называет шторку, а не первый её раздел", async () => {
    await renderWithStores(
      <DataSheet
        exportText="{}"
        fileName="thorne.json"
        error={null}
        catalogSource="built_in"
        onImport={() => {}}
        onStartOver={() => {}}
        onClose={() => {}}
      />,
    );

    const sheet = screen.getByRole("dialog", { name: "Данные" });
    const title = within(sheet).getByRole("heading", { name: "Данные", level: 2 });

    expect(sheet.getAttribute("aria-labelledby")).toBe(title.id);
    expect(sheet.hasAttribute("aria-label")).toBe(false);

    // Разделы стоят под именем шторки, а не вместо него.
    expect(within(sheet).getByRole("heading", { name: "Выгрузка", level: 3 })).toBeDefined();
    expect(within(sheet).getByRole("heading", { name: "Загрузка", level: 3 })).toBeDefined();
  });
});

describe("возврат к чистому состоянию из «Данных» (FR-330)", () => {
  /** Шторка с наблюдаемым сбросом: чем именно она его исполняет, решает экран, а не она. */
  async function open(onStartOver: () => void) {
    await renderWithStores(
      <DataSheet
        exportText="{}"
        fileName="thorne.json"
        error={null}
        catalogSource="built_in"
        onImport={() => {}}
        onStartOver={onStartOver}
        onClose={() => {}}
      />,
    );
    return within(screen.getByRole("dialog", { name: "Данные" }));
  }

  it("начать заново стоит под выгрузкой и спрашивает подтверждение", async () => {
    const user = userEvent.setup();
    let reset = false;
    const sheet = await open(() => (reset = true));

    // Копию берут до, а не после: раздел стоит ниже выгрузки.
    const headings = sheet.getAllByRole("heading").map((heading) => heading.textContent);
    expect(headings.indexOf("Чистое состояние")).toBeGreaterThan(headings.indexOf("Выгрузка"));

    await user.click(sheet.getByRole("button", { name: "Начать заново" }));

    // Отмены у этого нажатия нет, и цена названа прежде него, а не после.
    expect(screen.getByRole("dialog", { name: "Начать заново?" })).toBeDefined();
    expect(reset).toBe(false);
  });

  it("подтверждённое начало заново отдаёт команду сброса", async () => {
    const user = userEvent.setup();
    let reset = false;
    const sheet = await open(() => (reset = true));

    await user.click(sheet.getByRole("button", { name: "Начать заново" }));
    await user.click(screen.getByRole("button", { name: "Удалить и начать" }));

    expect(reset).toBe(true);
  });
});
