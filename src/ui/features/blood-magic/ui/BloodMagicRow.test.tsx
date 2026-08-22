// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { Command } from "@/contract/commands";
import { IN_FIGHT, testSnapshot } from "@/ui/app/testing/stores";
import { BloodMagicRow } from "@/ui/features/blood-magic/ui/BloodMagicRow";

// Автоматической очистки нет: тесты не пользуются глобалями vitest.
afterEach(cleanup);

/** Кровь подавлена солнцем: помеха приходит из состояния, а не из подстановки. */
const SUPPRESSED: readonly Command[] = [...IN_FIGHT, { kind: "set_sunlight", underSunlight: true }];

/** Действие израсходовано настоящим заговором: обмену оно не мешает — хода он не занимает. */
const ACTION_SPENT: readonly Command[] = [
  ...IN_FIGHT,
  { kind: "cast_spell", spellId: "ray-of-frost", mode: "cantrip", payment: { kind: "none" } },
];

function renderRow(commands: readonly Command[] = IN_FIGHT): void {
  const snapshot = testSnapshot(undefined, commands);
  render(
    <ul>
      <BloodMagicRow
        bloodMagic={snapshot.bloodMagic}
        casting={snapshot.casting}
        resources={snapshot.resources}
        onOpen={() => {}}
      />
    </ul>,
  );
}

describe("BloodMagicRow (FR-207)", () => {
  it("причина недоступности — целая фраза, как у заклинания", () => {
    renderRow(SUPPRESSED);

    expect(
      screen.getByText("Недоступно: Кровавое колдовство не действует под прямым солнечным светом"),
    ).toBeDefined();
  });

  it("израсходованное действие обмену не мешает", () => {
    renderRow(ACTION_SPENT);

    expect(screen.queryByText(/Недоступно/)).toBeNull();
  });

  it("доступная строка причины не называет", () => {
    renderRow();

    expect(screen.queryByText(/Недоступно/)).toBeNull();
  });

  it("значок разрешения называет «Без броска» общей сборкой, а не своей копией", () => {
    renderRow();

    expect(screen.getByText("Без броска")).toBeDefined();
  });

  it("курс ступени возвышения приезжает посчитанным: три хита за очко", () => {
    renderRow();

    expect(screen.getByText("3 хита за очко")).toBeDefined();
  });
});
