// @vitest-environment jsdom

/**
 * Ряд «чем платить» на настоящем снимке: проекции строит тот же презентер, что и в приложении, а
 * пулы обнуляются теми же операциями, какими их тратят за столом.
 *
 * Смысловой тон читается по классу плитки: стилей в тестовом DOM нет, и цвет здесь виден только так.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import {
  withSpellPoints,
  withoutHitDice,
  withoutRunes,
} from "@/core/infrastructure/catalog/thorne/fixtures";
import { testSnapshot } from "@/ui/app/testing/stores";
import { ResourceHeader } from "./ResourceHeader";

afterEach(cleanup);

type Tile = { text: string; classes: string };

function tiles(character: CharacterState): Tile[] {
  const snapshot = testSnapshot(character);
  render(
    <ResourceHeader
      sheet={snapshot.sheet}
      resources={snapshot.resources}
      onOpenArmorClass={() => undefined}
      onOpenHitPoints={() => undefined}
      onEditResources={() => undefined}
    />,
  );
  return within(screen.getByLabelText("Чем платить"))
    .getAllByRole("listitem")
    .map((item) => ({ text: item.textContent ?? "", classes: item.className }));
}

/** Плитка пула по её подписи: прогон называет ресурс словом, а не местом в ряду. */
function pool(rows: Tile[], name: string): Tile {
  const found = rows.find((row) => row.text.includes(name));
  if (found === undefined) throw new Error(`нет плитки ${name}`);
  return found;
}

describe("пустой пул подан пустым", () => {
  it("нулевой пул подан как ноль", () => {
    const full = tiles(withSpellPoints(createThorne(), 5));

    expect(pool(full, "Кости").text).toBe("✚ Кости d67/7");
    expect(pool(full, "Руны").text).toBe("❖ Руны3/3");
    expect(pool(full, "Очки").text).toBe("✚ Очки5");
    // Цвет руны — цвет ритуала, и носит его полный пул.
    expect(pool(full, "Руны").classes).toContain("ritual");

    cleanup();
    const drained = tiles(withoutRunes(withoutHitDice(createThorne())));

    // Платить нечем ни одним из трёх — и это видно знаком, а не только цифрой.
    expect(pool(drained, "Кости").text).toBe("✗ Кости d60/7");
    expect(pool(drained, "Руны").text).toBe("✗ Руны0/3");
    expect(pool(drained, "Очки").text).toBe("✗ Очки0");
    expect(pool(drained, "Руны").classes).not.toContain("ritual");
  });

  it("постоянный цвет обещал бы остаток: пустой пул и полный не совпадают ничем", () => {
    const full = tiles(withSpellPoints(createThorne(), 5));
    cleanup();
    const drained = tiles(withoutRunes(createThorne()));

    expect(pool(drained, "Руны").classes).not.toBe(pool(full, "Руны").classes);
    expect(pool(drained, "Очки").text).not.toBe(pool(full, "Очки").text);
  });
});
