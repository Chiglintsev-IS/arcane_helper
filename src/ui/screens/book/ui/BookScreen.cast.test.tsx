// @vitest-environment jsdom

/**
 * Применение из «Книги»: шаг, которого в бою не бывает.
 *
 * «Волшебный замок» подготовки не занимает и в боевом списке не стоит, поэтому единственный экран,
 * где этот путь проходится, — книжный.
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BookScreen } from "@/ui/screens/book/ui/BookScreen";
import { renderWithStores } from "@/ui/app/testing/stores";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

describe("шаг компонентов", () => {
  it("появляется для компонента со стоимостью и объясняет, что фокусировка его не заменяет", async () => {
    const user = userEvent.setup();
    // «Волшебный замок» отложен столом: карточка в контенте есть, а в книге его нет. Единственный
    // оплачиваемый компонент — у него, поэтому прогон записывает его в книгу и готовит: проверяется
    // шаг компонентов, а не сегодняшний состав книги.
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
    // Чем сотворить → компоненты: золотая пыль требует отдельного шага, и он же подтверждает.
    await user.click(screen.getByRole("button", { name: "Далее" }));

    expect(screen.getByText(/Шаг 2 из 2: Компоненты/)).toBeDefined();
    expect(screen.getByText(/фокусировка не заменяет/)).toBeDefined();
  });
});
