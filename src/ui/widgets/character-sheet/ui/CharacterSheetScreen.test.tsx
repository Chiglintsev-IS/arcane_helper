// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { CharacterSheetScreen } from "./CharacterSheetScreen";

afterEach(cleanup);

function renderSheet(character = createThorne(), onEdit = () => {}, onAddItem = () => {}) {
  return render(
    <CharacterSheetScreen character={character} onEdit={onEdit} onAddItem={onAddItem} />,
  );
}

describe("режим «Лист»", () => {
  it("открывается персонажем: числа боя стоят рядом с тем, из чего сложились (FR-230)", () => {
    renderSheet();
    expect(screen.getByRole("heading", { name: "Кто он" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Числа боя" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Здоровье" })).toBeDefined();
    // Навыки живут внутри своей характеристики, отдельного блока «Навыки» на листе нет.
    expect(screen.getByRole("heading", { name: "Интеллект" })).toBeDefined();
    expect(screen.queryByRole("heading", { name: "Навыки" })).toBeNull();
    expect(screen.getByText("Лунный тролль")).toBeDefined();
    // Вкладки «Итог» нет вовсе: каждое число листа и без неё действующее.
    expect(screen.queryByRole("tab", { name: "Итог" })).toBeNull();
  });

  it("здоровье показывает действующие числа, а не слагаемые (FR-230)", () => {
    const state = createThorne();
    renderSheet({
      ...state,
      temporaryHitPoints: 5,
      hitPoints: { ...state.hitPoints, current: 24, maximumBase: 38, bloodReduction: 4 },
    });

    expect(screen.getByText("24 из 34")).toBeDefined();
    expect(screen.getByText("(+5 временных)")).toBeDefined();
    // Снижение названо подсказкой у действующего максимума, а не своей строкой.
    expect(screen.getByText("(38 −4 кровью)")).toBeDefined();
    expect(screen.queryByText("Снижение кровью")).toBeNull();
  });

  it("у каждого блока есть кнопка правки с внятным именем", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: "Править: Интеллект" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Править: Уровень" })).toBeDefined();
  });

  it("вкладка «Вещи» отвечает и за вещи, и за доспех (FR-230)", async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole("tab", { name: "Вещи" }));

    expect(screen.getByRole("heading", { name: "Вещи" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Доспех" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Прибавки без вещи" })).toBeDefined();
    // Список вещей правится вещью, а не кнопкой над списком.
    expect(screen.queryByRole("button", { name: "Править: Вещи" })).toBeNull();
  });

  it("вещь заводится одним названием и открывается нажатием (FR-241)", async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    const onEdit = vi.fn();
    const state = createThorne();
    state.equipment.items = [{ id: "зелье", nameRu: "Зелье лечения", worn: false, count: 2 }];
    renderSheet(state, onEdit, onAddItem);

    await user.click(screen.getByRole("tab", { name: "Вещи" }));

    await user.type(screen.getByLabelText("Новая вещь"), "Сапоги следопыта{Enter}");
    expect(onAddItem).toHaveBeenCalledWith("Сапоги следопыта");

    await user.click(screen.getByRole("button", { name: "Открыть: Зелье лечения" }));
    expect(onEdit).toHaveBeenCalledWith("item:зелье");
  });

  it("подсказка стоит рядом со значением, а не вместо него", () => {
    const state = createThorne();
    renderSheet({ ...state, overrides: { ...state.overrides, initiative: 5 } });
    expect(screen.getByText("(введено руками)")).toBeDefined();
  });
});
