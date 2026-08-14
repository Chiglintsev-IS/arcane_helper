// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { testSnapshot } from "@/ui/app/testing/stores";
import { ProficienciesSheet } from "./ProficienciesSheet";

afterEach(cleanup);

describe("шторка владений", () => {
  it("владения: список режется по запятой, пустая строка даёт пустой список", async () => {
    const onSave = vi.fn();
    render(
      <ProficienciesSheet
        proficiencies={testSnapshot().sheet.proficiencies}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    await userEvent.clear(screen.getByLabelText("Оружие"));
    await userEvent.type(screen.getByLabelText("Оружие"), "кинжал, боевой посох ,");
    await userEvent.clear(screen.getByLabelText("Доспехи"));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].weapons).toEqual(["кинжал", "боевой посох"]);
    expect(onSave.mock.calls[0]?.[0].armor).toEqual([]);
  });

  it("владения: языки шторка не трогает — она отдаёт их такими, какими взяла", async () => {
    const onSave = vi.fn();
    const proficiencies = { ...testSnapshot().sheet.proficiencies, languages: ["Общий"] };
    render(
      <ProficienciesSheet proficiencies={proficiencies} onSave={onSave} onCancel={() => {}} />,
    );

    // Языкам здесь нет ни поля, ни правки: их правит своя шторка, и потерять их эта не вправе.
    expect(screen.queryByLabelText("Знает")).toBeNull();
    await userEvent.type(screen.getByLabelText("Инструменты"), "инструменты кузнеца");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].languages).toEqual(["Общий"]);
    expect(onSave.mock.calls[0]?.[0].tools).toEqual(["инструменты кузнеца"]);
  });
});
