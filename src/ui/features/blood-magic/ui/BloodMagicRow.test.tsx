// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { TurnEconomy } from "@/core/application/useCases/turn";
import { BloodMagicRow } from "@/ui/features/blood-magic/ui/BloodMagicRow";

// Автоматической очистки нет: тесты не пользуются глобалями vitest.
afterEach(cleanup);

const IN_TURN: TurnEconomy = {
  round: 1,
  inFight: true,
  actionAvailable: true,
  bonusActionAvailable: true,
  reactionAvailable: true,
};

function renderRow(economy: TurnEconomy): void {
  render(
    <ul>
      <BloodMagicRow character={createThorne()} economy={economy} onOpen={() => {}} />
    </ul>,
  );
}

describe("BloodMagicRow (FR-207)", () => {
  it("причина недоступности — целая фраза, как у заклинания", () => {
    renderRow({ ...IN_TURN, actionAvailable: false });

    expect(screen.getByText("Недоступно: Действие уже израсходовано")).toBeDefined();
  });

  it("доступная строка причины не называет", () => {
    renderRow(IN_TURN);

    expect(screen.queryByText(/Недоступно/)).toBeNull();
  });

  it("значок разрешения называет «Без броска» общей сборкой, а не своей копией", () => {
    renderRow(IN_TURN);

    expect(screen.getByText("Без броска")).toBeDefined();
  });
});
