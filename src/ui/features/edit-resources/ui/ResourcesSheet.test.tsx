// @vitest-environment jsdom

/**
 * Шторка ручной правки сама по себе: подтверждения у неё нет, и назвать себя ей тем более нечем,
 * кроме собственного заголовка.
 */

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { renderWithStores, testSnapshot } from "@/ui/app/testing/stores";
import { ResourcesSheet } from "./ResourcesSheet";

/** Ресурсы приезжают из настоящего снимка: остатки и максимумы считает владелец. */
async function openResources(): Promise<void> {
  const character = createThorne();
  const { resources } = testSnapshot(character);
  await renderWithStores(
    <ResourcesSheet
      resources={resources}
      onSpendSlot={() => {}}
      onRefundSlot={() => {}}
      onAdjustRunes={() => {}}
      onSunlight={() => {}}
      onClose={() => {}}
    />,
    character,
  );
}

describe("шторка ручной правки ресурсов называет своё дело (FR-274)", () => {
  it("ресурсы: заголовок называет дело, и он же — имя шторки", async () => {
    await openResources();

    const sheet = screen.getByRole("dialog", { name: "Правка ресурсов" });
    const title = within(sheet).getByRole("heading", { name: "Правка ресурсов" });

    // Имя шторки не вторая копия заголовка, а он сам: расходиться двум строкам здесь не с чем.
    expect(sheet.getAttribute("aria-labelledby")).toBe(title.id);
    expect(sheet.hasAttribute("aria-label")).toBe(false);
  });

  it("ресурсы: шторка без подтверждения названа так же, как шторка с ним", async () => {
    await openResources();

    const sheet = screen.getByRole("dialog", { name: "Правка ресурсов" });

    // Каждое нажатие вступает в силу сразу: спросить, во что попал палец, будет уже не у кого.
    expect(within(sheet).queryByRole("button", { name: "Подтвердить" })).toBeNull();
    expect(within(sheet).getByRole("button", { name: "Закрыть" })).toBeDefined();
    expect(within(sheet).getByRole("heading", { name: "Правка ресурсов" })).toBeDefined();
  });
});
