// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { CharacterSheetScreen } from "./CharacterSheetScreen";

afterEach(cleanup);

describe("режим «Лист»", () => {
  it("открывается итогом: числа, которые спрашивают за столом", () => {
    render(<CharacterSheetScreen character={createThorne()} onEdit={() => {}} />);
    expect(screen.getByRole("heading", { name: "Числа боя" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Здоровье" })).toBeDefined();
    // База и вещи — в своих вкладках: итог не смешан с тем, из чего сложился.
    expect(screen.queryByRole("heading", { name: "Кто он" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Доспех" })).toBeNull();
  });

  it("вкладка «Персонаж» показывает базу", async () => {
    const user = userEvent.setup();
    render(<CharacterSheetScreen character={createThorne()} onEdit={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Персонаж" }));

    expect(screen.getByRole("heading", { name: "Кто он" })).toBeDefined();
    // Навыки живут внутри своей характеристики, отдельного блока «Навыки» на листе нет.
    expect(screen.getByRole("heading", { name: "Интеллект" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Навыки" })).toBeNull();
    expect(screen.getByText("Лунный тролль")).toBeDefined();
  });

  it("у каждого блока есть кнопка правки с внятным именем", async () => {
    const user = userEvent.setup();
    render(<CharacterSheetScreen character={createThorne()} onEdit={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Персонаж" }));

    expect(screen.getByRole("button", { name: "Править: Интеллект" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Править: Уровень" })).toBeDefined();
  });

  it("вкладки «Экипировка» и «Инвентарь» отвечают за вещи", async () => {
    const user = userEvent.setup();
    render(<CharacterSheetScreen character={createThorne()} onEdit={() => {}} />);

    await user.click(screen.getByRole("tab", { name: "Экипировка" }));
    expect(screen.getByRole("heading", { name: "Доспех" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Прибавки без вещи" })).toBeDefined();

    await user.click(screen.getByRole("tab", { name: "Инвентарь" }));
    expect(screen.getByRole("heading", { name: "Вещи" })).toBeDefined();
  });

  it("подсказка стоит рядом со значением, а не вместо него", () => {
    const state = createThorne();
    render(
      <CharacterSheetScreen
        character={{ ...state, overrides: { ...state.overrides, initiative: 5 } }}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText("(введено руками)")).toBeDefined();
  });
});
