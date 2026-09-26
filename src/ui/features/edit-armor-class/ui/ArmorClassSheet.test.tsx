// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { createWizard } from "@/core/infrastructure/catalog/thorne/fixtures";
import { renderWithStores, testSnapshot } from "@/ui/app/testing/stores";
import { ArmorClassSheet } from "./ArmorClassSheet";

async function openArmorClass(onSave: (value: number) => void = () => {}): Promise<void> {
  const character = createWizard();
  const { resources } = testSnapshot(character);
  await renderWithStores(
    <ArmorClassSheet
      value={resources.armorClassAdjustment}
      onSave={onSave}
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

describe("поправка к КД набирается без клавиатуры", () => {
  it("кнопки «−» и «+» ведут число со знаком, и минус доступен без клавиатуры с минусом", async () => {
    const onSave = vi.fn();
    await openArmorClass(onSave);

    const less = screen.getByRole("button", { name: "Поправка: на единицу меньше" });
    await userEvent.click(less);
    await userEvent.click(less);
    expect(screen.getByRole("status").textContent).toBe("−2");
    expect(screen.queryByRole("spinbutton")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(onSave).toHaveBeenCalledWith(-2);
  });
});
