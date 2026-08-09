// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CharacterState } from "@/core/domain/assembly/state";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withBloodExchange, withDamage } from "@/core/infrastructure/catalog/thorne/fixtures";
import { renderWithStores, testSnapshot } from "@/ui/app/testing/stores";
import { HealthSheet } from "./HealthSheet";

/**
 * Шторка рендерится на настоящем ядре: действующий максимум от набранного считает жизнеспособность,
 * а не шторка, и приходит он ответом на вопрос.
 */
async function openHealth(
  character: CharacterState = createThorne(),
  onSave: (change: { maximumBase: number; masterReduction: number }) => void = () => {},
): Promise<void> {
  const { sheet } = testSnapshot(character);
  await renderWithStores(
    <HealthSheet hitPoints={sheet.hitPoints} onSave={onSave} onCancel={() => {}} />,
    character,
  );
}

describe("шторка здоровья", () => {
  it("здоровье: снижение кровью показано, но не правится", async () => {
    // Два очка кровью — 6 хитов и столько же максимума, потом 14 хитов урона.
    const hurt = withDamage(withBloodExchange(createThorne(), 2), 14);
    await openHealth(hurt);

    expect(screen.getByText(/Снижение кровью — 6/)).toBeDefined();
    expect(screen.queryByLabelText("Снижение кровью")).toBeNull();
  });

  it("здоровье: набранный максимум уходит владельцу, отказ приходит от него", async () => {
    // Два очка кровью — 6 хитов и столько же максимума, потом 14 хитов урона.
    const onSave = vi.fn();
    const hurt = withDamage(withBloodExchange(createThorne(), 2), 14);
    await openHealth(hurt, onSave);

    await userEvent.clear(screen.getByLabelText("Базовый максимум"));
    await userEvent.type(screen.getByLabelText("Базовый максимум"), "6");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // Меньше уже снятого кровью — отказ жизнеспособности, а не решение шторки.
    expect(onSave).toHaveBeenCalledWith({ maximumBase: 6, masterReduction: 0 });
  });

  it("здоровье: пустое поле показывает прочерк вместо действующего максимума", async () => {
    await openHealth();

    await userEvent.clear(screen.getByLabelText("Базовый максимум"));

    expect(screen.getByText(/Действующий максимум станет —/)).toBeDefined();
  });

  it("здоровье: сохранение отдаёт базу и снижение мастера", async () => {
    const onSave = vi.fn();
    await openHealth(createThorne(), onSave);

    await userEvent.clear(screen.getByLabelText("Снижение мастера"));
    await userEvent.type(screen.getByLabelText("Снижение мастера"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ maximumBase: 60, masterReduction: 10 });
  });
});
