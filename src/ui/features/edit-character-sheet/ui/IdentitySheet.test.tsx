// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { testSnapshot } from "@/ui/app/testing/stores";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { IdentitySheet } from "./IdentitySheet";

afterEach(cleanup);

describe("шторка «кто он»", () => {
  it("кто он: владений и языков здесь нет — их правят свои шторки (FR-230)", () => {
    render(<IdentitySheet choices={toChoicesView()} sheet={testSnapshot().sheet} onSave={() => {}} onCancel={() => {}} />);

    expect(screen.queryByLabelText("Языки")).toBeNull();
    expect(screen.queryByLabelText("Оружие")).toBeNull();
    expect(screen.getByLabelText("Вид")).toBeDefined();
  });

  it("кто он: размер выбирается кнопкой, возраст числом", async () => {
    const onSave = vi.fn();
    render(<IdentitySheet choices={toChoicesView()} sheet={testSnapshot().sheet} onSave={onSave} onCancel={() => {}} />);

    await userEvent.click(screen.getByRole("radio", { name: "Огромный" }));
    await userEvent.clear(screen.getByLabelText("Возраст"));
    await userEvent.type(screen.getByLabelText("Возраст"), "142");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].size).toBe("huge");
    expect(onSave.mock.calls[0]?.[0].age).toBe(142);
  });

  it("кто он: пустая скорость не уходит владельцу и отказывает у поля", async () => {
    const onSave = vi.fn();
    render(<IdentitySheet choices={toChoicesView()} sheet={testSnapshot().sheet} onSave={onSave} onCancel={() => {}} />);

    const speed = screen.getByLabelText("Скорость");
    await userEvent.clear(speed);
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).not.toHaveBeenCalled();
    const reason = screen.getByRole("alert");
    expect(reason.textContent).toBe("Наберите число");
    expect(speed.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"));

    await userEvent.type(speed, "30");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("кто он: пустое имя уходит владельцу — отказывает он", async () => {
    const onSave = vi.fn();
    render(<IdentitySheet choices={toChoicesView()} sheet={testSnapshot().sheet} onSave={onSave} onCancel={() => {}} />);

    await userEvent.clear(screen.getByLabelText("Имя"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).not.toHaveBeenCalledWith(expect.objectContaining({ name: "Торн" }));
  });
});
