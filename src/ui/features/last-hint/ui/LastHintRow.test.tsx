// @vitest-environment jsdom

/**
 * Последняя подсказка строкой списка действий: её читают там же, где спрашивают «чем сходить».
 *
 * Прогон идёт на настоящем снимке ядра: имя ресурса называет его владелец, и набранное здесь руками
 * разошлось бы с ним при первой же правке.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { testSnapshot } from "@/ui/app/testing/stores";

import { LastHintRow } from "./LastHintRow";

afterEach(cleanup);

const RESOURCES = testSnapshot().resources;

/** Подсказка истрачена: остаток нулевой, максимум прежний. */
function spent(): typeof RESOURCES {
  return { ...RESOURCES, lastHint: { ...RESOURCES.lastHint, remaining: 0 } };
}

describe("последняя подсказка в списке действий (FR-329)", () => {
  it("строка называет особенность полным именем и пересказывает повод", () => {
    render(<LastHintRow resources={RESOURCES} onOpen={() => undefined} />);

    const row = screen.getByRole("button");
    expect(row.textContent).toContain("Последняя подсказка");
    expect(row.textContent).toContain("бонус мастерства");
  });

  it("истраченная остаётся строкой и называет причину словами", () => {
    render(<LastHintRow resources={spent()} onOpen={() => undefined} />);

    // Пропавшая строка читалась бы как «такой особенности нет», а не как «она уже потрачена».
    expect(screen.getByRole("button").textContent).toContain("0/1");
    expect(screen.getByText(/уже потрачена/)).toBeDefined();
  });

  it("строка открывается в чтение", async () => {
    const user = userEvent.setup();
    let opened = false;
    render(<LastHintRow resources={RESOURCES} onOpen={() => (opened = true)} />);

    await user.click(screen.getByRole("button"));

    expect(opened).toBe(true);
  });
});
