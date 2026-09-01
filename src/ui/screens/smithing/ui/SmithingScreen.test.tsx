// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithStores } from "@/ui/app/testing/stores";

import { SmithingScreen } from "./SmithingScreen";

describe("«Кузнечное дело»", () => {
  it("экран называет ремесло и говорит словами, почему считать нечего", async () => {
    await renderWithStores(<SmithingScreen />);

    expect(screen.getByRole("heading", { name: "Кузнечное дело" })).toBeDefined();
    expect(screen.getByText(/Правил и чисел мастер пока не дал/)).toBeDefined();
    expect(screen.getByText(/Здесь встанет верстак/)).toBeDefined();
  });
});
