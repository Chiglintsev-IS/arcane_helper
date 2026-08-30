// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithStores } from "@/ui/app/testing/stores";
import { ConfirmSheet } from "./ConfirmSheet";

describe("шторка подтверждения называет своё дело (FR-274)", () => {
  it("подтверждение: имя шторки — её заголовок, а не вторая его копия", async () => {
    await renderWithStores(
      <ConfirmSheet
        title="Бой закончен?"
        body="Счёт раундов начнётся заново."
        confirmLabel="Да, бой закончен"
        cancelLabel="Нет, продолжается"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );

    const sheet = screen.getByRole("dialog", { name: "Бой закончен?" });
    const title = within(sheet).getByRole("heading", { name: "Бой закончен?" });

    expect(sheet.getAttribute("aria-labelledby")).toBe(title.id);
    expect(sheet.hasAttribute("aria-label")).toBe(false);
  });
});
