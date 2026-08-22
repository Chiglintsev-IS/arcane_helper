// @vitest-environment jsdom

/**
 * Чтение о последней подсказке и её расход: приложение ведёт запас, повод и бросок ведёт стол.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { testSnapshot } from "@/ui/app/testing/stores";

import { LastHintSheet } from "./LastHintSheet";

afterEach(cleanup);

const RESOURCES = testSnapshot().resources;

describe("расход последней подсказки (FR-309)", () => {
  it("счёт правится одним контролом, и он же возвращает списанное", async () => {
    const user = userEvent.setup();
    const deltas: number[] = [];
    render(
      <LastHintSheet
        resources={RESOURCES}
        onAdjust={(delta) => deltas.push(delta)}
        onClose={() => undefined}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Потратить: Последняя подсказка" }));

    expect(deltas).toEqual([-1]);
    // Полный пул возвращать нечего: «+» отказывает пределом, а не молча уводит выше максимума.
    expect(
      screen.getByRole("button", { name: "Вернуть: Последняя подсказка" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("истраченная подсказка называет, чем вернётся", () => {
    render(
      <LastHintSheet
        resources={{ ...RESOURCES, lastHint: { ...RESOURCES.lastHint, remaining: 0 } }}
        onAdjust={() => undefined}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText(/вернётся долгим отдыхом/)).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Потратить: Последняя подсказка" }).hasAttribute("disabled"),
    ).toBe(true);
  });
});
