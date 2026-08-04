// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MoneySheet } from "./MoneySheet";

afterEach(cleanup);

describe("шторка денег", () => {
  it("деньги: три монеты стола правятся итогом (FR-242)", async () => {
    const onSave = vi.fn();
    render(
      <MoneySheet
        money={{ gold: 15, silver: 30, copper: 12 }}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    const gold = screen.getByLabelText("Золото");
    await userEvent.clear(gold);
    await userEvent.type(gold, "215");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ gold: 215, silver: 30, copper: 12 });
  });

  it("деньги: отрицательное и пустое не сохраняются", async () => {
    render(
      <MoneySheet money={{ gold: 15, silver: 0, copper: 0 }} onSave={() => {}} onCancel={() => {}} />,
    );

    const gold = screen.getByLabelText("Золото");
    await userEvent.clear(gold);
    await userEvent.type(gold, "-5");
    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);

    await userEvent.clear(gold);
    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);

    // Дробное не усечётся молча: «12.5» — отказ, а не двенадцать.
    await userEvent.type(gold, "12.5");
    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });
});
