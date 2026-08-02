// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";

import { SpellCardCompact } from "./SpellCardCompact";

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
