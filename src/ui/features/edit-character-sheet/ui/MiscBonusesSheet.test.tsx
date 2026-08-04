// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { MiscBonusesSheet } from "./MiscBonusesSheet";

afterEach(cleanup);

describe("шторка прочих прибавок", () => {
  it("прочие прибавки: отрицательная принимается — проклятие тоже вклад", async () => {
    const onSave = vi.fn();
    render(<MiscBonusesSheet character={createThorne()} onSave={onSave} onCancel={() => {}} />);

    const field = screen.getByLabelText("К защите");
    await userEvent.clear(field);
    await userEvent.type(field, "-1");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ spellcasting: 0, armorClass: -1, savingThrows: 0 });
  });

  it("прочие прибавки: пустое поле не сохраняется", async () => {
    render(<MiscBonusesSheet character={createThorne()} onSave={() => {}} onCancel={() => {}} />);

    await userEvent.clear(screen.getByLabelText("К магии"));

    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });
});
