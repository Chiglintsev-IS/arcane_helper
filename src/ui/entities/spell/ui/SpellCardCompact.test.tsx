// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

import { SpellCardCompact } from "./SpellCardCompact";

// Автоматической очистки нет: тесты не пользуются глобалями vitest.
afterEach(cleanup);

const BASE_SPELL = loadThorneSpells()[0]!;

describe("SpellCardCompact — дальность в ряду фактов без ярлыка", () => {
  it("особая дальность называет себя сама, а не показывает голое «Особая»", () => {
    render(
      <SpellCardCompact
        spell={{ ...BASE_SPELL, range: { type: "special" } }}
        character={createThorne()}
        unavailableReason={null}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText("Особая дальность")).toBeDefined();
    expect(screen.queryByText("Особая", { exact: true })).toBeNull();
  });
});
