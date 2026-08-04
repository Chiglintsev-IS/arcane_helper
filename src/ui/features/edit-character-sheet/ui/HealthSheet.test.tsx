// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { HealthSheet } from "./HealthSheet";

afterEach(cleanup);

describe("шторка здоровья", () => {
  it("здоровье: снижение кровью показано, но не правится", () => {
    const state = createThorne();
    const hurt = {
      ...state,
      hitPoints: { current: 40, maximumBase: 60, bloodReduction: 6, masterReduction: 0 },
    };
    render(<HealthSheet character={hurt} onSave={() => {}} onCancel={() => {}} />);

    expect(screen.getByText(/Снижение кровью — 6/)).toBeDefined();
    expect(screen.queryByLabelText("Снижение кровью")).toBeNull();
  });

  it("здоровье: максимум ниже уже снятого кровью не сохраняется", async () => {
    const state = createThorne();
    const hurt = {
      ...state,
      hitPoints: { current: 40, maximumBase: 60, bloodReduction: 6, masterReduction: 0 },
    };
    render(<HealthSheet character={hurt} onSave={() => {}} onCancel={() => {}} />);

    await userEvent.clear(screen.getByLabelText("Базовый максимум"));
    await userEvent.type(screen.getByLabelText("Базовый максимум"), "6");

    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });

  it("здоровье: пустое поле показывает прочерк вместо действующего максимума", async () => {
    render(<HealthSheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);

    await userEvent.clear(screen.getByLabelText("Базовый максимум"));

    expect(screen.getByText(/Действующий максимум станет —/)).toBeDefined();
  });

  it("здоровье: сохранение отдаёт базу и снижение мастера", async () => {
    const onSave = vi.fn();
    render(<HealthSheet character={createThorne()} onSave={onSave} onCancel={() => {}} />);

    await userEvent.clear(screen.getByLabelText("Снижение мастера"));
    await userEvent.type(screen.getByLabelText("Снижение мастера"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ maximumBase: 60, masterReduction: 10 });
  });
});
