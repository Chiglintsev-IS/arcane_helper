// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { renderWithStores, testSnapshot } from "@/ui/app/testing/stores";
import { ArmorClassSheet } from "./ArmorClassSheet";

async function openArmorClass(): Promise<void> {
  const character = createThorne();
  const { resources } = testSnapshot(character);
  await renderWithStores(
    <ArmorClassSheet
      value={resources.armorClassAdjustment}
      onSave={() => {}}
      onCancel={() => {}}
    />,
    character,
  );
}

describe("шторка поправки к КД называет своё дело (FR-274)", () => {
  it("КД: заголовок называет дело, и он же — имя шторки", async () => {
    await openArmorClass();

    const sheet = screen.getByRole("dialog", { name: "КД" });
    const title = within(sheet).getByRole("heading", { name: "КД" });

    expect(sheet.getAttribute("aria-labelledby")).toBe(title.id);
    expect(sheet.hasAttribute("aria-label")).toBe(false);

    expect(within(sheet).getByLabelText("Поправка")).toBeDefined();
  });

  it("КД: заголовок не зовёт правкой то, что подтверждают", async () => {
    await openArmorClass();

    const sheet = screen.getByRole("dialog", { name: "КД" });

    expect(within(sheet).getByRole("heading").textContent).not.toContain("Правка");
    expect(within(sheet).getByRole("button", { name: "Подтвердить" })).toBeDefined();
    expect(within(sheet).queryByRole("button", { name: "Сохранить" })).toBeNull();
  });
});
