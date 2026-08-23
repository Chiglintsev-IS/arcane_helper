// @vitest-environment jsdom

/**
 * Экран лога проверяется отдельно от экрана боя: компонент презентационный, записи
 * подаются параметром, и обе стороны каждого условия видны сразу — пустой лог на настоящем
 * состоянии пришлось бы ещё добыть.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Log } from "@/ui/widgets/log/ui/Log";
import type { LogEntry } from "@/core/domain/log/entry";

afterEach(cleanup);

function entry(id: string, summaryRu: string): LogEntry {
  return { id, at: "2026-07-31T18:00:00.000Z", kind: "spell_cast", summaryRu, undoPatch: {} };
}

describe("экран лога (FR-113)", () => {
  it("свежее сверху", () => {
    render(
      <Log
        entries={[entry("id-1", "Бой начался"), entry("id-2", "Огненный шар — ячейка 3 уровня")]}
        onUndo={() => {}}
        onData={() => {}}
      />,
    );

    const rows = within(screen.getByRole("list", { name: "Лог событий" })).getAllByRole(
      "listitem",
    );
    expect(rows[0]?.textContent).toContain("Огненный шар");
    expect(rows[1]?.textContent).toContain("Бой начался");
  });

  it("кнопка отмены только на верхней записи", () => {
    render(
      <Log
        entries={[entry("id-1", "Бой начался"), entry("id-2", "Огненный шар — ячейка 3 уровня")]}
        onUndo={() => {}}
        onData={() => {}}
      />,
    );

    // Одна кнопка на весь список: отменяется только последнее, и кнопка на остальных
    // записях обещала бы недоступное.
    expect(screen.getAllByRole("button", { name: /^Вернуть/ })).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Вернуть: Огненный шар — ячейка 3 уровня" }),
    ).toBeDefined();
  });

  it("возврат сделанного назван не отменой (FR-264)", () => {
    render(<Log entries={[entry("id-1", "Бой начался")]} onUndo={() => {}} onData={() => {}} />);

    // Отменой уходят со шторки, ничего не изменив; здесь возвращают сделанное — дела разные.
    expect(screen.getByRole("button", { name: "Вернуть: Бой начался" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Отмен/ })).toBeNull();
  });

  it("нажатие зовёт отмену", async () => {
    const onUndo = vi.fn();
    render(<Log entries={[entry("id-1", "Бой начался")]} onUndo={onUndo} onData={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /^Вернуть/ }));

    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("строка называет время", () => {
    render(<Log entries={[entry("id-1", "Бой начался")]} onUndo={() => {}} onData={() => {}} />);

    // Час не сверяется с числом: он зависит от часового пояса прогона, а проверяется здесь формат.
    expect(screen.getByText(/^\d{2}:\d{2}$/)).toBeDefined();
  });

  it("отмена называет возвращённое", async () => {
    const older = entry("id-1", "Бой начался");
    const newest = entry("id-2", "Магическое восстановление: 1×3 ур.");
    const { rerender } = render(
      <Log entries={[older, newest]} onUndo={() => {}} onData={() => {}} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Вернуть/ }));
    rerender(<Log entries={[older]} onUndo={() => {}} onData={() => {}} />);

    const returned = screen.getByRole("status");
    expect(returned.textContent).toContain("Вернулось");
    expect(returned.textContent).toContain("Магическое восстановление: 1×3 ур.");
    // Строка встаёт на место исчезнувшей записи: иначе кнопка отмены следующей осталась бы
    // ровно под тем же пальцем.
    const list = screen.getByRole("list", { name: "Лог событий" });
    expect(returned.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("отклонённая отмена ничего не обещает", async () => {
    const entries = [entry("id-1", "Бой начался"), entry("id-2", "Огненный шар")];
    render(<Log entries={entries} onUndo={() => {}} onData={() => {}} />);

    // Отказ ядра оставляет запись на месте, и возвращать по ней нечего.
    await userEvent.click(screen.getByRole("button", { name: /^Вернуть/ }));

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("отмена последней записи оставляет строку в пустом логе", async () => {
    const { rerender } = render(
      <Log entries={[entry("id-1", "Бой начался")]} onUndo={() => {}} onData={() => {}} />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Вернуть/ }));
    rerender(<Log entries={[]} onUndo={() => {}} onData={() => {}} />);

    expect(screen.getByRole("status").textContent).toContain("Бой начался");
    expect(screen.getByText("Пока ничего не произошло.")).toBeDefined();
  });

  it("пустой лог объясняет, а не показывает кнопку", () => {
    render(<Log entries={[]} onUndo={() => {}} onData={() => {}} />);

    expect(screen.getByText("Пока ничего не произошло.")).toBeDefined();
    expect(screen.queryByRole("button", { name: /^Вернуть/ })).toBeNull();
  });
});
