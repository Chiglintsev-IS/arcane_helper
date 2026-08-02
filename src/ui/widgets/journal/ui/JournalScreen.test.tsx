// @vitest-environment jsdom

/**
 * Экран журнала проверяется отдельно от экрана боя: компонент презентационный, записи
 * подаются параметром, и обе стороны каждого условия видны сразу — пустой журнал на настоящем
 * состоянии пришлось бы ещё добыть.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { JournalScreen } from "@/ui/widgets/journal/ui/JournalScreen";
import type { JournalEntry } from "@/core/application/session";

afterEach(cleanup);

function entry(id: string, summaryRu: string): JournalEntry {
  return { id, at: "2026-07-31T18:00:00.000Z", kind: "spell_cast", summaryRu, undoPatch: {} };
}

describe("экран журнала (FR-113)", () => {
  it("свежее сверху", () => {
    render(
      <JournalScreen
        entries={[entry("id-1", "Бой начался"), entry("id-2", "Огненный шар — ячейка 3 уровня")]}
        onUndo={() => {}}
      />,
    );

    const rows = within(screen.getByRole("list", { name: "Журнал событий" })).getAllByRole(
      "listitem",
    );
    expect(rows[0]?.textContent).toContain("Огненный шар");
    expect(rows[1]?.textContent).toContain("Бой начался");
  });

  it("кнопка отмены только на верхней записи", () => {
    render(
      <JournalScreen
        entries={[entry("id-1", "Бой начался"), entry("id-2", "Огненный шар — ячейка 3 уровня")]}
        onUndo={() => {}}
      />,
    );

    // Одна кнопка на весь список: отменяется только последнее, и кнопка на остальных
    // записях обещала бы недоступное.
    expect(screen.getAllByRole("button", { name: /^Отменить/ })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Отменить: Огненный шар — ячейка 3 уровня" }),
    ).toBeDefined();
  });

  it("нажатие зовёт отмену", async () => {
    const onUndo = vi.fn();
    render(<JournalScreen entries={[entry("id-1", "Бой начался")]} onUndo={onUndo} />);

    await userEvent.click(screen.getByRole("button", { name: /^Отменить/ }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("строка называет время", () => {
    render(<JournalScreen entries={[entry("id-1", "Бой начался")]} onUndo={() => {}} />);

    // Час не сверяется с числом: он зависит от часового пояса прогона, а проверяется здесь формат.
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeDefined();
  });

  it("пустой журнал объясняет, а не показывает кнопку", () => {
    render(<JournalScreen entries={[]} onUndo={() => {}} />);

    expect(screen.getByText("Пока ничего не произошло.")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();
  });
});
