// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { LevelSheet } from "./LevelSheet";

afterEach(cleanup);

describe("шторка уровня", () => {
  it("уровень: показывает, что изменится, до подтверждения", async () => {
    render(<LevelSheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);

    const field = screen.getByLabelText("Уровень");
    await userEvent.clear(field);
    await userEvent.type(field, "8");

    expect(screen.getByText(/Ячейки 4 уровня: 1 → 2/)).toBeDefined();
    expect(screen.getByText(/Кости хитов: 7 → 8/)).toBeDefined();
    expect(screen.getByText(/Лимит подготовки: 11 → 12/)).toBeDefined();
  });

  it("уровень: рост бонуса мастерства двигает руны", async () => {
    render(<LevelSheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);

    const field = screen.getByLabelText("Уровень");
    await userEvent.clear(field);
    await userEvent.type(field, "9");

    expect(screen.getByText(/Руны: 3 → 4/)).toBeDefined();
  });

  it("уровень: вне диапазона 1–20 перечня изменений нет — считать нечего", async () => {
    render(<LevelSheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);

    const field = screen.getByLabelText("Уровень");
    await userEvent.clear(field);
    await userEvent.type(field, "21");

    // Перечня изменений нет: считать по невозможному уровню нечего, а отказ придёт от владельца.
    expect(screen.queryByText(/Ячейки/)).toBeNull();
  });

  it("уровень: максимум хитов подсказывает среднее, но не подставляет", () => {
    render(<LevelSheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByLabelText("Базовый максимум хитов")).toHaveProperty("value", "60");
    expect(screen.getByText(/среднее за уровень: \+7/)).toBeDefined();
  });

  it("уровень: сохранение отдаёт уровень и введённый максимум", async () => {
    const onSave = vi.fn();
    render(<LevelSheet character={createThorne()} onSave={onSave} onCancel={() => {}} />);

    const level = screen.getByLabelText("Уровень");
    await userEvent.clear(level);
    await userEvent.type(level, "8");
    const maximum = screen.getByLabelText("Базовый максимум хитов");
    await userEvent.clear(maximum);
    await userEvent.type(maximum, "66");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ level: 8, hitPointMaximumBase: 66 });
  });
});
