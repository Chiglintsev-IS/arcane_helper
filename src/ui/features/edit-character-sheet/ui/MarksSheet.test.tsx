// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { testSnapshot } from "@/ui/app/testing/stores";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { MarksSheet } from "./MarksSheet";

afterEach(cleanup);

describe("шторка отметок мастера", () => {
  it("отметки мастера: ступень истощения от нуля до шести", async () => {
    const onSave = vi.fn();
    render(<MarksSheet choices={toChoicesView()} marks={testSnapshot().sheet} onSave={onSave} onCancel={() => {}} />);

    await userEvent.click(screen.getByRole("radio", { name: "Ступень 3" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ exhaustion: 3, inspiration: false });
  });

  it("отметки мастера: вдохновение переключается", async () => {
    const onSave = vi.fn();
    render(<MarksSheet choices={toChoicesView()} marks={testSnapshot().sheet} onSave={onSave} onCancel={() => {}} />);

    await userEvent.click(screen.getByLabelText("Вдохновение"));
    await userEvent.click(screen.getByRole("radio", { name: "Без истощения" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave).toHaveBeenCalledWith({ exhaustion: 0, inspiration: true });
  });

  it("отмена закрывает шторку, ничего не сохраняя", async () => {
    const onCancel = vi.fn();
    const onSave = vi.fn();
    render(<MarksSheet choices={toChoicesView()} marks={testSnapshot().sheet} onSave={onSave} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
