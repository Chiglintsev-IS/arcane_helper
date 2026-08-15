// @vitest-environment jsdom

/**
 * Шторка данных: разделов у неё три, и ни один из них не имя шторки — имя у неё своё.
 */

import { screen, within } from "@testing-library/react";
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
