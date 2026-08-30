// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withoutLastHint } from "@/core/infrastructure/catalog/thorne/fixtures";
import { testSnapshot } from "@/ui/app/testing/stores";

import { LastHintRow } from "./LastHintRow";

afterEach(cleanup);

const RESOURCES = testSnapshot().resources;

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
