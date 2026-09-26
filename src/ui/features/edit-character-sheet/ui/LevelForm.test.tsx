// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CharacterState } from "@/core/domain/assembly/state";
import { createWizard, withSlotDebt } from "@/core/infrastructure/catalog/thorne/fixtures";
import { renderWithStores, testSnapshot } from "@/ui/app/testing/stores";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { WRITTEN, type WriteAnswer } from "@/ui/shared/ui/FieldForm";

import { LevelForm } from "./LevelForm";

async function openLevel(
  character: CharacterState = createWizard(),
  onSave: (next: { level: number; hitPointMaximumBase: number }) => WriteAnswer = () => WRITTEN,
): Promise<void> {
  const { sheet } = testSnapshot(character);
  await renderWithStores(
    <LevelForm choices={toChoicesView()}
      level={sheet.level}
      hitPoints={sheet.hitPoints}
      onWrite={onSave}
      onClose={() => {}}
    />,
    character,
  );
}

describe("форма уровня", () => {
  it("уровень: показывает, что изменится, до подтверждения", async () => {
    await openLevel();

    const field = screen.getByLabelText("Уровень");
    await userEvent.clear(field);
    await userEvent.type(field, "8");

    expect(screen.getByText(/Ячейки 4 уровня: 1 → 2/)).toBeDefined();
    expect(screen.getByText(/Кости хитов: 7 → 8/)).toBeDefined();
    expect(screen.getByText(/Заклинаний в подготовке: 11 → 12/)).toBeDefined();
  });

  it("уровень: рост бонуса мастерства двигает руны", async () => {
    await openLevel();

    const field = screen.getByLabelText("Уровень");
    await userEvent.clear(field);
    await userEvent.type(field, "9");

    expect(screen.getByText(/Руны: 3 → 4/)).toBeDefined();
  });

  it("уровень: дневной бюджет восстановления назван в перечне сдвигов", async () => {
    await openLevel();

    const field = screen.getByLabelText("Уровень");
    await userEvent.clear(field);
    await userEvent.type(field, "9");

    expect(screen.getByText(/Магическое восстановление: 4 → 5/)).toBeDefined();
  });

  it("уровень: долг ячейки перечню сдвигов не мешает", async () => {
    await openLevel(withSlotDebt(createWizard(), 1));

    const field = screen.getByLabelText("Уровень");
    await userEvent.clear(field);
    await userEvent.type(field, "9");

    expect(screen.getByText(/Ячейки 5 уровня: 0 → 1/)).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("уровень: вне диапазона 1–20 перечня изменений нет — считать нечего", async () => {
    await openLevel();

    const field = screen.getByLabelText("Уровень");
    await userEvent.clear(field);
    await userEvent.type(field, "21");

    expect(screen.queryByText(/Ячейки/)).toBeNull();
  });

  it("уровень: максимум хитов подсказывает среднее, но не подставляет", async () => {
    await openLevel();
    expect(screen.getByLabelText("Базовый максимум хитов")).toHaveProperty("value", "60");
    expect(await screen.findByText(/среднее за уровень: \+7/)).toBeDefined();
  });

  it("уровень: пустое поле не уходит владельцу и отказывает у себя", async () => {
    const onSave = vi.fn<Parameters<typeof LevelForm>[0]["onWrite"]>(() => WRITTEN);
    await openLevel(createWizard(), onSave);

    const maximum = screen.getByLabelText("Базовый максимум хитов");
    await userEvent.clear(maximum);
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).not.toHaveBeenCalled();
    const reason = screen.getByRole("alert");
    expect(reason.textContent).toBe("Наберите число");
    expect(maximum.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"));
    expect(screen.getByLabelText("Уровень").getAttribute("aria-invalid")).toBe("false");

    await userEvent.type(maximum, "60");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("уровень: сохранение отдаёт уровень и введённый максимум", async () => {
    const onSave = vi.fn<Parameters<typeof LevelForm>[0]["onWrite"]>(() => WRITTEN);
    await openLevel(createWizard(), onSave);

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
