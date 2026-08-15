// @vitest-environment jsdom

/**
 * Шторка поправки сама по себе, без экрана: чем она названа, отвечает она, а не тот, кто её открыл.
 */

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { renderWithStores, testSnapshot } from "@/ui/app/testing/stores";
import { ArmorClassSheet } from "./ArmorClassSheet";

/** Поправка приезжает из настоящего снимка: вторым счётом её здесь не заводят. */
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

    // Имя шторки не вторая копия заголовка, а он сам: расходиться двум строкам здесь не с чем.
    expect(sheet.getAttribute("aria-labelledby")).toBe(title.id);
    expect(sheet.hasAttribute("aria-label")).toBe(false);

    // Заголовок называет число, а набираемое называет поле: одно слово не занято дважды.
    expect(within(sheet).getByLabelText("Поправка")).toBeDefined();
  });

  it("КД: заголовок не зовёт правкой то, что подтверждают", async () => {
    await openArmorClass();

    const sheet = screen.getByRole("dialog", { name: "КД" });

    // Поправку кладёт мастер: это случившееся за столом, а не запись, которую сохраняют.
    expect(within(sheet).getByRole("heading").textContent).not.toContain("Правка");
    expect(within(sheet).getByRole("button", { name: "Подтвердить" })).toBeDefined();
    expect(within(sheet).queryByRole("button", { name: "Сохранить" })).toBeNull();
  });
});
