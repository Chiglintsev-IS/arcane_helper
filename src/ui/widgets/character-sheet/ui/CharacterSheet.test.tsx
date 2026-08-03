// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { CharacterSheet } from "./CharacterSheet";

afterEach(cleanup);

describe("режим «Лист»", () => {
  it("одна колонка базы: без вкладок, без чисел боя, без вещей (FR-230)", () => {
    render(<CharacterSheet character={createThorne()} onEdit={() => {}} />);

    expect(screen.getByRole("heading", { name: "Кто он" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Здоровье" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Отметки мастера" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Интеллект" })).toBeDefined();
    expect(screen.getByText("Лунный тролль")).toBeDefined();

    // Вкладок нет: лист перестал делиться, вещи ушли в «Сумку», числа боя — в шапку «Игры».
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Числа боя" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Вещи" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Навыки" })).toBeNull();
  });

  it("здоровье показывает действующие числа, а не слагаемые (FR-240)", () => {
    const state = createThorne();
    render(
      <CharacterSheet
        character={{
          ...state,
          temporaryHitPoints: 5,
          hitPoints: { ...state.hitPoints, current: 24, maximumBase: 38, bloodReduction: 4 },
        }}
        onEdit={() => {}}
      />,
    );

    expect(screen.getByText("24 из 34")).toBeDefined();
    expect(screen.getByText("(+5 временных)")).toBeDefined();
    // Снижение названо подсказкой у действующего максимума, а не своей строкой.
    expect(screen.getByText("(38 −4 кровью)")).toBeDefined();
    expect(screen.queryByText("Снижение кровью")).toBeNull();
  });

  it("у каждого блока есть кнопка правки с внятным именем, перебивки — у отметок", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<CharacterSheet character={createThorne()} onEdit={onEdit} />);

    expect(screen.getByRole("button", { name: "Править: Интеллект" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Править: Уровень" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Править: Перебивки" }));
    expect(onEdit).toHaveBeenCalledWith({ block: "combatNumbers" });
  });

  it("подсказка стоит рядом со значением, а не вместо него", () => {
    const state = createThorne();
    render(
      <CharacterSheet
        character={{ ...state, overrides: { ...state.overrides, initiative: 5 } }}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText("(введено руками)")).toBeDefined();
  });
});
