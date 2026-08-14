// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { testSnapshot } from "@/ui/app/testing/stores";
import { LanguagesSheet } from "./LanguagesSheet";

afterEach(cleanup);

describe("шторка языков", () => {
  it("языки: список режется по запятой, а владения шторка отдаёт нетронутыми", async () => {
    const onSave = vi.fn();
    const proficiencies = { ...testSnapshot().sheet.proficiencies, tools: ["алхимические принадлежности"] };
    render(<LanguagesSheet proficiencies={proficiencies} onSave={onSave} onCancel={() => {}} />);

    await userEvent.type(screen.getByLabelText("Знает"), "общий, троллий ,");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].languages).toEqual(["общий", "троллий"]);
    expect(onSave.mock.calls[0]?.[0].tools).toEqual(["алхимические принадлежности"]);
  });
});
