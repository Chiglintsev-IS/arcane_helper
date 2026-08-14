// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CharacterState } from "@/core/domain/assembly/state";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withBloodExchange, withDamage } from "@/core/infrastructure/catalog/thorne/fixtures";
import { renderWithStores, testSnapshot } from "@/ui/app/testing/stores";
import { HitPointsSheet } from "./HitPointsSheet";

/**
 * Шторка рендерится на настоящем ядре: действующий максимум от набранного считает жизнеспособность,
 * а не шторка, и приходит он ответом на вопрос.
 */
async function openHitPoints(
  character: CharacterState = createThorne(),
  onMaximum: (change: { maximumBase: number; masterReduction: number }) => void = () => {},
): Promise<void> {
  const { sheet } = testSnapshot(character);
  await renderWithStores(
    <HitPointsSheet
      hitPoints={sheet.hitPoints}
      onDamage={() => {}}
      onHeal={() => {}}
      onTemporary={() => {}}
      onMaximum={onMaximum}
      onCancel={() => {}}
    />,
    character,
  );
}

describe("шторка хитов", () => {
  it("хиты: урон, лечение, временные и максимум правятся одной шторкой (FR-230)", async () => {
    await openHitPoints();

    // Максимум стоит там же, где урон: на «Листе» его нет — лист не правит того, что двигает игра.
    for (const tab of ["Урон", "Лечение", "Временные", "Максимум"]) {
      expect(screen.getByRole("radio", { name: tab })).toBeDefined();
    }
    expect(screen.queryByLabelText("Базовый максимум")).toBeNull();
  });

  it("хиты: снижение кровью названо, но не правится (FR-240)", async () => {
    // Два очка кровью — 6 хитов и столько же максимума, потом 14 хитов урона.
    const hurt = withDamage(withBloodExchange(createThorne(), 2), 14);
    await openHitPoints(hurt);
    await userEvent.click(screen.getByRole("radio", { name: "Максимум" }));

    expect(screen.getByText(/Снижение кровью — 6/)).toBeDefined();
    expect(screen.queryByLabelText("Снижение кровью")).toBeNull();
  });

  it("хиты: набранный максимум уходит владельцу, а действующий считает ядро (FR-240)", async () => {
    // Два очка кровью — 6 хитов и столько же максимума, потом 14 хитов урона.
    const onMaximum = vi.fn();
    const hurt = withDamage(withBloodExchange(createThorne(), 2), 14);
    await openHitPoints(hurt, onMaximum);
    await userEvent.click(screen.getByRole("radio", { name: "Максимум" }));

    await userEvent.clear(screen.getByLabelText("Базовый максимум"));
    await userEvent.type(screen.getByLabelText("Базовый максимум"), "6");
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    // Меньше уже снятого кровью — отказ жизнеспособности, а не решение шторки.
    expect(onMaximum).toHaveBeenCalledWith({ maximumBase: 6, masterReduction: 0 });
  });

  it("хиты: пустое поле показывает прочерк вместо действующего максимума", async () => {
    await openHitPoints();
    await userEvent.click(screen.getByRole("radio", { name: "Максимум" }));

    await userEvent.clear(screen.getByLabelText("Базовый максимум"));

    expect(screen.getByText(/Действующий максимум станет —/)).toBeDefined();
  });

  it("хиты: сохранение отдаёт базу и снижение мастера", async () => {
    const onMaximum = vi.fn();
    await openHitPoints(createThorne(), onMaximum);
    await userEvent.click(screen.getByRole("radio", { name: "Максимум" }));

    await userEvent.clear(screen.getByLabelText("Снижение мастера"));
    await userEvent.type(screen.getByLabelText("Снижение мастера"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    expect(onMaximum).toHaveBeenCalledWith({ maximumBase: 60, masterReduction: 10 });
  });
});
