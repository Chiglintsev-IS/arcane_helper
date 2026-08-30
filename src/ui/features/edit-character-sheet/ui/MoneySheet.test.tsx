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
        money={[
          { currency: "gold", amount: 15 },
          { currency: "silver", amount: 30 },
          { currency: "copper", amount: 12 },
        ]}
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

  it("деньги: пустая монета не уходит владельцу и отказывает у своего поля", async () => {
    const onSave = vi.fn();
    render(
      <MoneySheet
        money={[
          { currency: "gold", amount: 15 },
          { currency: "silver", amount: 30 },
          { currency: "copper", amount: 12 },
        ]}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    const silver = screen.getByLabelText("Серебро");
    await userEvent.clear(silver);
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).not.toHaveBeenCalled();
    const reason = screen.getByRole("alert");
    expect(reason.textContent).toBe("Наберите число");
    expect(silver.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"));
    expect(screen.getByLabelText("Золото").getAttribute("aria-invalid")).toBe("false");

    await userEvent.type(silver, "30");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("деньги: отрицательное уходит владельцу — отказывает он", async () => {
    const onSave = vi.fn();
    render(
      <MoneySheet
        money={[
          { currency: "gold", amount: 15 },
          { currency: "silver", amount: 0 },
          { currency: "copper", amount: 0 },
        ]}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    const gold = screen.getByLabelText("Золото");
    await userEvent.clear(gold);
    await userEvent.type(gold, "-5");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0]).toEqual({ gold: -5, silver: 0, copper: 0 });
  });
});
