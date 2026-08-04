// @vitest-environment jsdom

/**
 * Применение из «Книги»: шаг, которого в бою не бывает.
 *
 * «Опознание» творится минуту, поэтому в списке боя его нет вовсе — единственный экран, где этот
 * путь проходится, книжный.
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BookScreen } from "@/ui/screens/book/ui/BookScreen";
import { renderWithStores } from "@/ui/app/testing/stores";

describe("шаг компонентов", () => {
  it("появляется для компонента со стоимостью и объясняет, что фокусировка его не заменяет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<BookScreen />);

    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /^Опознание/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    // Чем сотворить → компоненты → объявление: жемчужина требует отдельного шага.
    await user.click(screen.getByRole("button", { name: "Далее" }));

    expect(screen.getByText(/Шаг 2 из 3: Компоненты/)).toBeDefined();
    expect(screen.getByText(/фокусировка не заменяет/)).toBeDefined();
  });
});
