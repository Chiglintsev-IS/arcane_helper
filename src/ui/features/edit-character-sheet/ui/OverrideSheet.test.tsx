// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OverrideSheet } from "./OverrideSheet";

afterEach(cleanup);

describe("шторка перебивки", () => {
  it("перебивка: «По формуле» снимает введённое руками", async () => {
    const onSave = vi.fn();
    render(
      <OverrideSheet
        id="spellSaveDc"
        formulaValue={16}
        currentValue={18}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "По формуле" }));

    expect(onSave).toHaveBeenCalledWith(null);
  });

  it("перебивка: введённое число сохраняется, формула названа рядом", async () => {
    const onSave = vi.fn();
    render(
      <OverrideSheet
        id="spellSaveDc"
        formulaValue={16}
        currentValue={16}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText("По формуле — 16.")).toBeDefined();
    await userEvent.clear(screen.getByLabelText("Значение"));
    await userEvent.type(screen.getByLabelText("Значение"), "18");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith(18);
  });

  it("перебивка: пустое поле уходит владельцу — отказывает он", async () => {
    const onSave = vi.fn();
    render(
      <OverrideSheet
        id="initiative"
        formulaValue={2}
        currentValue={2}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    await userEvent.clear(screen.getByLabelText("Значение"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0]).toBeNaN();
  });
});
