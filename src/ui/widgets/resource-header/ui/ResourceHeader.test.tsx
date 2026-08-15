// @vitest-environment jsdom

/**
 * Ряд прочих ресурсов на настоящем снимке: проекции строит тот же презентер, что и в приложении, а
 * пулы обнуляются теми же операциями, какими их тратят за столом.
 *
 * Смысловой тон читается по классу значка: стилей в тестовом DOM нет, и цвет здесь виден только так.
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
import { ResourceBadges } from "./ResourceHeader";

afterEach(cleanup);

type BadgeRow = { text: string; classes: string };

function badges(character: CharacterState): BadgeRow[] {
  const snapshot = testSnapshot(character);
  render(
    <ResourceBadges
      sheet={snapshot.sheet}
      resources={snapshot.resources}
      turn={snapshot.turn}
      bookCastingTimes={new Set()}
    />,
  );
  return within(screen.getByLabelText("Прочие ресурсы"))
    .getAllByRole("listitem")
    .map((item) => ({
      text: item.textContent ?? "",
      classes: item.firstElementChild?.className ?? "",
    }));
}

/** Значок пула по его подписи: прогон называет ресурс словом, а не местом в ряду. */
function pool(rows: BadgeRow[], name: string): BadgeRow {
  const found = rows.find((row) => row.text.includes(name));
  if (found === undefined) throw new Error(`нет значка ${name}`);
  return found;
}

describe("пустой пул подан пустым", () => {
  it("нулевой пул подан как ноль", () => {
    const full = badges(withSpellPoints(createThorne(), 5));

    expect(pool(full, "Кости").text).toBe("✚Кости 7d6");
    expect(pool(full, "Руны").text).toBe("❖Руны 3/3");
    expect(pool(full, "Очки").text).toBe("✚Очки 5");
    // Цвет руны — цвет ритуала, и носит его полный пул.
    expect(pool(full, "Руны").classes).toContain("ritual");

    cleanup();
    const drained = badges(withoutRunes(withoutHitDice(createThorne())));

    // Платить нечем ни одним из трёх — и это видно знаком, а не только цифрой.
    expect(pool(drained, "Кости").text).toBe("✗Кости 0d6 из 7");
    expect(pool(drained, "Руны").text).toBe("✗Руны 0/3");
    expect(pool(drained, "Очки").text).toBe("✗Очки 0");
    expect(pool(drained, "Руны").classes).not.toContain("ritual");
  });

  it("постоянный цвет обещал бы остаток: пустой пул и полный не совпадают ничем", () => {
    const full = badges(withSpellPoints(createThorne(), 5));
    cleanup();
    const drained = badges(withoutRunes(createThorne()));

    expect(pool(drained, "Руны").classes).not.toBe(pool(full, "Руны").classes);
    expect(pool(drained, "Очки").text).not.toBe(pool(full, "Очки").text);
  });
});
