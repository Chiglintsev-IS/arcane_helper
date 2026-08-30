// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BookScreen } from "@/ui/screens/book/ui/BookScreen";
import { renderWithStores } from "@/ui/app/testing/stores";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

describe("шаг компонентов", () => {
  it("появляется для компонента со стоимостью и объясняет, что фокусировка его не заменяет", async () => {
    const user = userEvent.setup();
    const thorne = createThorne();
    const withLock = {
      ...thorne,
      spellbookSpellIds: [...thorne.spellbookSpellIds, "arcane-lock"],
      preparedSpellIds: [
        ...thorne.preparedSpellIds.filter((id) => id !== "intellect-fortress"),
        "arcane-lock",
      ],
    };
    await renderWithStores(<BookScreen />, withLock);

    await user.click(screen.getByRole("button", { name: /^Волшебный замок/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));

    expect(screen.getByText(/Шаг 2 из 2: Компоненты/)).toBeDefined();
    expect(screen.getByText(/фокусировка не заменяет/)).toBeDefined();
  });
});
