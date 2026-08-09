// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { testSnapshot } from "@/ui/app/testing/stores";

import { SpellCardCompact } from "./SpellCardCompact";

// Автоматической очистки нет: тесты не пользуются глобалями vitest.
afterEach(cleanup);

const SNAPSHOT = testSnapshot();
const BASE_ROW = SNAPSHOT.spells[0]!;

describe("SpellCardCompact — дальность в ряду фактов без ярлыка", () => {
  it("особая дальность называет себя сама, а не показывает голое «Особая»", () => {
    render(
      <SpellCardCompact
        spell={{ ...BASE_ROW, range: { type: "special" } }}
        casting={SNAPSHOT.casting}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText("Особая дальность")).toBeDefined();
    expect(screen.queryByText("Особая", { exact: true })).toBeNull();
  });
});
