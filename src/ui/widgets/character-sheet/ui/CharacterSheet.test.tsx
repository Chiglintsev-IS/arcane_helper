// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { toSheetView } from "@/core/presentation/views/sheetView";
import { CharacterSheet } from "./CharacterSheet";

afterEach(cleanup);

describe("режим «Лист»", () => {
  it("одна колонка базы: без вкладок, без чисел боя, без вещей (FR-230)", () => {
    render(
      <CharacterSheet
        stats={toChoicesView().stats}
        sheet={toSheetView(createThorne())}
        onEdit={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { name: "Кто он" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Отметки мастера" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Интеллект" })).toBeDefined();
    expect(screen.getByText("Лунный тролль")).toBeDefined();

    // Вкладок нет: лист перестал делиться, вещи ушли в «Сумку», числа боя — в шапку «Игры».
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Числа боя" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Вещи" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Навыки" })).toBeNull();
  });

  it("того, что двигает игра, на листе нет: ни защиты, ни хитов (FR-230)", () => {
    const state = createThorne();
    render(
      <CharacterSheet
        stats={toChoicesView().stats}
        sheet={toSheetView({
          ...state,
          temporaryHitPoints: 5,
          hitPoints: { ...state.hitPoints, current: 24, maximumBase: 38, bloodReduction: 4 },
        })}
        onEdit={() => {}}
      />,
    );

    // Ни блоков, ни кнопок правки: хиты правятся в «Игре», защита — надетым и заклинанием.
    expect(screen.queryByRole("heading", { name: "Здоровье" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Класс Доспеха" })).toBeNull();
    expect(screen.queryByText("24 из 34")).toBeNull();
    expect(screen.queryByRole("button", { name: "Править: Здоровье" })).toBeNull();
  });

  it("у каждого блока есть кнопка правки с внятным именем", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <CharacterSheet
        stats={toChoicesView().stats}
        sheet={toSheetView(createThorne())}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByRole("button", { name: "Править: Интеллект" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Править: Уровень" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Править: Постоянные вклады" }));
    expect(onEdit).toHaveBeenCalledWith({ block: "permanent" });
  });

  it("подсказка стоит рядом со значением, а не вместо него", () => {
    const state = createThorne();
    render(
      <CharacterSheet
        stats={toChoicesView().stats}
        sheet={toSheetView({
          ...state,
          permanentContributions: [
            {
              nameRu: "Дар богов",
              contribution: { stat: "initiative", kind: "bonus", value: 5 },
            },
          ],
        })}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText("(Инициатива)")).toBeDefined();
  });
});
