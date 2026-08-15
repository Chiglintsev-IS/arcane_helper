// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { toSheetView } from "@/core/presentation/views/sheetView";
import { CharacterSheet } from "./CharacterSheet";

afterEach(cleanup);

describe("режим «Лист»", () => {
  it("одна колонка базы: без вкладок, без чисел боя, без вещей (FR-230)", () => {
    render(
      <CharacterSheet
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

  it("правимый блок называет свою кнопку внятным именем", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <CharacterSheet
        sheet={toSheetView(createThorne())}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByRole("button", { name: "Править: Интеллект" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Править: Уровень" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Править: Языки" }));
    expect(onEdit).toHaveBeenCalledWith({ block: "languages" });
  });

  it("«Лист»: особенность стоит карточкой и правки не предлагает (FR-230)", () => {
    render(<CharacterSheet sheet={toSheetView(createThorne())} onEdit={() => {}} />);

    expect(screen.getByRole("heading", { name: "Особенности" })).toBeDefined();
    expect(screen.getByText("Рунный почерк")).toBeDefined();
    expect(screen.getByText(/Минута изучения записи/)).toBeDefined();
    // Кнопки нет вовсе: погашенная обещала бы правку того, чего за столом не правят.
    expect(screen.queryByRole("button", { name: "Править: Особенности" })).toBeNull();
  });

  it("особенностей нет ни одной — карточка называет пустоту прочерком", () => {
    const state = createThorne();
    render(<CharacterSheet sheet={toSheetView({ ...state, features: [] })} onEdit={() => {}} />);

    const card = screen.getByRole("heading", { name: "Особенности" }).closest("section");
    expect(card?.textContent).toContain("—");
    expect(card?.textContent).not.toContain("Рунный почерк");
  });

  it("подсказка стоит рядом со значением, а не вместо него", () => {
    const state = createThorne();
    render(
      <CharacterSheet
        sheet={toSheetView({ ...state, skills: { arcana: "expert" } })}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText("(компетентность)")).toBeDefined();
  });
});
