// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { HealthSheet } from "./HealthSheet";
import { withBloodExchange, withDamage } from "@/core/infrastructure/catalog/thorne/fixtures";

afterEach(cleanup);

describe("шторка здоровья", () => {
  it("здоровье: снижение кровью показано, но не правится", () => {
    // Два очка кровью — 6 хитов и столько же максимума, потом 14 хитов урона.
    const hurt = withDamage(withBloodExchange(createThorne(), 2), 14);
    render(<HealthSheet character={hurt} onSave={() => {}} onCancel={() => {}} />);

    expect(screen.getByText(/Снижение кровью — 6/)).toBeDefined();
    expect(screen.queryByLabelText("Снижение кровью")).toBeNull();
  });

  it("здоровье: набранный максимум уходит владельцу, отказ приходит от него", async () => {
    // Два очка кровью — 6 хитов и столько же максимума, потом 14 хитов урона.
    const onSave = vi.fn();
    const hurt = withDamage(withBloodExchange(createThorne(), 2), 14);
    render(<HealthSheet character={hurt} onSave={onSave} onCancel={() => {}} />);

    await userEvent.clear(screen.getByLabelText("Базовый максимум"));
    await userEvent.type(screen.getByLabelText("Базовый максимум"), "6");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // Меньше уже снятого кровью — отказ жизнеспособности, а не решение шторки.
    expect(onSave).toHaveBeenCalledWith({ maximumBase: 6, masterReduction: 0 });
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
