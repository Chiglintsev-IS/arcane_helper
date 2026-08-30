// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withSpentSlots } from "@/core/infrastructure/catalog/thorne/fixtures";
import { renderWithStores, testSnapshot } from "@/ui/app/testing/stores";
import { ArcaneRecoverySheet } from "@/ui/features/arcane-recovery/ui/ArcaneRecoverySheet";

describe("шторка магического восстановления (FR-274)", () => {
  it("шторка восстановления названа заголовком, и он же — её имя", async () => {
    const spent = withSpentSlots(createThorne(), 1, 2);
    const { recovery } = testSnapshot(spent, [{ kind: "short_rest" }]);

    await renderWithStores(
      <ArcaneRecoverySheet
        recovery={recovery.arcaneRecovery}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
      spent,
    );

    const sheet = screen.getByRole("dialog", { name: "Магическое восстановление" });
    const title = within(sheet).getByRole("heading", { name: "Магическое восстановление" });

    expect(sheet.getAttribute("aria-labelledby")).toBe(title.id);
    expect(sheet.hasAttribute("aria-label")).toBe(false);
  });

  it("заголовок не пересказывает счётчик бюджета", async () => {
    const spent = withSpentSlots(createThorne(), 1, 2);
    const { recovery } = testSnapshot(spent, [{ kind: "short_rest" }]);

    await renderWithStores(
      <ArcaneRecoverySheet
        recovery={recovery.arcaneRecovery}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
      spent,
    );

    const sheet = screen.getByRole("dialog", { name: "Магическое восстановление" });
    expect(within(sheet).getByText("Суммарный уровень возвращаемых ячеек")).toBeDefined();
    expect(within(sheet).getByText(`0 из ${recovery.arcaneRecovery.remaining}`)).toBeDefined();
  });
});
