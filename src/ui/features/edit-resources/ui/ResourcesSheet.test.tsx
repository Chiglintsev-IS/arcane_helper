// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { renderWithStores, testSnapshot } from "@/ui/app/testing/stores";
import { ResourcesSheet } from "./ResourcesSheet";

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

    expect(sheet.getAttribute("aria-labelledby")).toBe(title.id);
    expect(sheet.hasAttribute("aria-label")).toBe(false);
  });

  it("ресурсы: шторка без подтверждения названа так же, как шторка с ним", async () => {
    await openResources();

    const sheet = screen.getByRole("dialog", { name: "Правка ресурсов" });

    expect(within(sheet).queryByRole("button", { name: "Подтвердить" })).toBeNull();
    expect(within(sheet).getByRole("button", { name: "Закрыть" })).toBeDefined();
    expect(within(sheet).getByRole("heading", { name: "Правка ресурсов" })).toBeDefined();
  });
});
