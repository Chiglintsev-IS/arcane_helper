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

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withoutLastHint } from "@/core/infrastructure/catalog/thorne/fixtures";
import { testSnapshot } from "@/ui/app/testing/stores";

import { LastHintRow } from "./LastHintRow";

afterEach(cleanup);

const RESOURCES = testSnapshot().resources;

/** Подсказка истрачена: состояние собрано операцией владельца, а не набранным числом. */
const SPENT = testSnapshot(withoutLastHint(createThorne())).resources;

describe("последняя подсказка в списке действий (FR-329)", () => {
  it("строка называет особенность полным именем и пересказывает повод", () => {
    render(<LastHintRow resources={RESOURCES} onOpen={() => undefined} />);

    const row = screen.getByRole("button");
    expect(row.textContent).toContain("Последняя подсказка");
    expect(row.textContent).toContain("бонус мастерства");
  });

  it("истраченная остаётся строкой и называет причину словами", () => {
    render(<LastHintRow resources={SPENT} onOpen={() => undefined} />);

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
