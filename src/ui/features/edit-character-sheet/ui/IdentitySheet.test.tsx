// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { IdentitySheet } from "./IdentitySheet";

afterEach(cleanup);

describe("шторка «кто он»", () => {
  it("кто он: список владений режется по запятой, пустая строка даёт пустой список", async () => {
    const onSave = vi.fn();
    render(<IdentitySheet character={createThorne()} onSave={onSave} onCancel={() => {}} />);

    await userEvent.type(screen.getByLabelText("Языки"), "общий, троллий ,");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].proficiencies.languages).toEqual(["общий", "троллий"]);
    expect(onSave.mock.calls[0]?.[0].proficiencies.tools).toEqual([]);
  });

  it("кто он: размер выбирается кнопкой, возраст числом", async () => {
    const onSave = vi.fn();
    render(<IdentitySheet character={createThorne()} onSave={onSave} onCancel={() => {}} />);

    await userEvent.click(screen.getByRole("radio", { name: "Огромный" }));
    await userEvent.clear(screen.getByLabelText("Возраст"));
    await userEvent.type(screen.getByLabelText("Возраст"), "142");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].size).toBe("huge");
    expect(onSave.mock.calls[0]?.[0].age).toBe(142);
  });

  it("кто он: пустое имя не сохраняется", async () => {
    render(<IdentitySheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);

    await userEvent.clear(screen.getByLabelText("Имя"));

    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });
});
