// @vitest-environment jsdom

/**
 * Блок отыгрыша: одна реплика цельной фразой (FR-050).
 *
 * Тест сторожит именно склейку: до этой работы карточка показывала «Стой на месте. · Холодно.» —
 * весь список реплик разом, будто персонаж произносит обе подряд.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { spell } from "@/testing/stores";
import { RoleplaySection } from "./RoleplaySection";

describe("реплика и жест", () => {
  it("показывает одну реплику в кавычках", () => {
    render(<RoleplaySection spell={spell("ray-of-frost")} />);
    expect(screen.getByText("«Стой на месте.»")).toBeDefined();
  });

  it("не склеивает художественные строки через разделитель", () => {
    const { container } = render(<RoleplaySection spell={spell("ray-of-frost")} />);
    expect(container.textContent).not.toContain(" · ");
  });

  it("показывает жест как отдельную строку", () => {
    render(<RoleplaySection spell={spell("shield")} />);
    expect(screen.getByText(spell("shield").roleplay.gesture)).toBeDefined();
  });
});
