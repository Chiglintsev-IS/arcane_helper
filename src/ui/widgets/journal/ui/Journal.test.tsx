// @vitest-environment jsdom

/**
 * Экран журнала проверяется отдельно от экрана боя: компонент презентационный, записи
 * подаются параметром, и обе стороны каждого условия видны сразу — пустой журнал на настоящем
 * состоянии пришлось бы ещё добыть.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Journal } from "@/ui/widgets/journal/ui/Journal";
import type { JournalEntry } from "@/core/domain/journal/entry";

afterEach(cleanup);

function entry(id: string, summaryRu: string): JournalEntry {
  return { id, at: "2026-07-31T18:00:00.000Z", kind: "spell_cast", summaryRu, undoPatch: {} };
}

describe("экран журнала (FR-113)", () => {
  it("свежее сверху", () => {
    render(
      <Journal
        entries={[entry("id-1", "Бой начался"), entry("id-2", "Огненный шар — ячейка 3 уровня")]}
        onUndo={() => {}}
        onData={() => {}}
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
      <Journal
        entries={[entry("id-1", "Бой начался"), entry("id-2", "Огненный шар — ячейка 3 уровня")]}
        onUndo={() => {}}
        onData={() => {}}
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
    render(<Journal entries={[entry("id-1", "Бой начался")]} onUndo={onUndo} onData={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /^Отменить/ }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("строка называет время", () => {
    render(<Journal entries={[entry("id-1", "Бой начался")]} onUndo={() => {}} onData={() => {}} />);

    // Час не сверяется с числом: он зависит от часового пояса прогона, а проверяется здесь формат.
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeDefined();
  });

  it("пустой журнал объясняет, а не показывает кнопку", () => {
    render(<Journal entries={[]} onUndo={() => {}} onData={() => {}} />);

    expect(screen.getByText("Пока ничего не произошло.")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();
  });
});
