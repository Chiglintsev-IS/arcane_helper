// @vitest-environment jsdom

/**
 * Ряды шапки на настоящем снимке: проекции строит тот же презентер, что и в приложении, а
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
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";
import { ResourceHeader } from "./ResourceHeader";

afterEach(cleanup);

type Tile = { text: string; classes: string };

/** Ряд оплаты на настоящем снимке: тот же презентер, что и в приложении. */
function payingRow(character: CharacterState): HTMLElement {
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
  return screen.getByLabelText("Чем платить");
}

function tiles(character: CharacterState): Tile[] {
  return within(payingRow(character))
    .getAllByRole("listitem")
    .map((item) => ({ text: item.textContent ?? "", classes: item.className }));
}

/** Плитка пула по её подписи: прогон называет ресурс словом, а не местом в ряду. */
function pool(rows: Tile[], name: string): Tile {
  const found = rows.find((row) => row.text.includes(name));
  if (found === undefined) throw new Error(`нет плитки ${name}`);
  return found;
}

describe("ряд оплаты на самом узком экране", () => {
  /**
   * Ширины в jsdom нет, и пиксели меряет прогон браузера на 320 × 568. Здесь стоит то, из чего эта
   * ширина складывается: сколько в ряду названо и сколько в нём нажимаемых мест. Нажимаемое место
   * уже наименьшего размера нажатия не бывает, и заведённое на каждый уровень ячейки оно занимало
   * бы ряд целиком — последней плитке места не осталось бы.
   */
  it("ряд «Чем платить» умещает все плитки на 320", () => {
    const row = payingRow(createThorne());

    for (const named of ["1 ур.", "2 ур.", "3 ур.", "4 ур.", "Руны", "Кости", "Очки"]) {
      expect(row.textContent).toContain(named);
    }

    // Дверь правки одна на ресурс: у ячеек всех уровней она общая, у рун своя, а кости и очки
    // правки не имеют вовсе — их двигают отдых и обмен кровью.
    expect(within(row).getAllByRole("button")).toHaveLength(2);
  });
});

describe("ступень плитки отвечает, метит ли в неё палец", () => {
  it("нажимаемая плитка ряда оплаты лежит на ступени нажимаемого", () => {
    const full = tiles(withSpellPoints(createThorne(), 5));

    // Руны ведут в ту же шторку, что и ячейки: одна дверь — одна шкура, а не две.
    expect(pool(full, "Руны").classes).toContain(SURFACE_CONTROL);

    // Кости и очки не нажимаются: их двигают отдых и обмен кровью, и ступень у них — группы.
    for (const name of ["Кости", "Очки"]) {
      expect(pool(full, name).classes).toContain(SURFACE_GROUP);
      expect(pool(full, name).classes).not.toContain(SURFACE_CONTROL);
    }

    cleanup();
    const drained = tiles(withoutRunes(createThorne()));

    // Истраченный пул опускается ступенью, как истраченная ячейка: пустая рука не нажимается так
    // же охотно, как полная.
    expect(pool(drained, "Руны").classes).toContain(SURFACE_GROUP);
    expect(pool(drained, "Руны").classes).not.toContain(SURFACE_CONTROL);
  });
});

describe("пустой пул подан пустым", () => {
  it("нулевой пул подан как ноль", () => {
    const full = tiles(withSpellPoints(createThorne(), 5));

    // Полный пул называет ресурс и остаток: знак при нём повторял бы то, что уже сказано числом.
    expect(pool(full, "Кости").text).toBe("Кости d67/7");
    expect(pool(full, "Руны").text).toBe("Руны3/3");
    expect(pool(full, "Очки").text).toBe("Очки5");

    cleanup();
    const drained = tiles(withoutRunes(withoutHitDice(createThorne())));

    // Платить нечем ни одним из трёх — и это видно знаком, а не только цифрой. Знак встаёт при
    // числе: подпись называет ресурс, и ширина плитки на исходе пула не меняется.
    expect(pool(drained, "Кости").text).toBe("Кости d6✗ 0/7");
    expect(pool(drained, "Руны").text).toBe("Руны✗ 0/3");
    expect(pool(drained, "Очки").text).toBe("Очки✗ 0");
  });

  it("пул не занимает смыслового цвета: зелёная руна читалась бы как ритуал", () => {
    const full = tiles(withSpellPoints(createThorne(), 5));

    for (const name of ["Кости", "Руны", "Очки"]) {
      for (const tone of ["ritual", "action", "reaction", "concentration", "bonus"]) {
        expect(pool(full, name).classes).not.toContain(tone);
      }
    }
  });

  it("постоянный цвет обещал бы остаток: пустой пул и полный не совпадают ничем", () => {
    const full = tiles(withSpellPoints(createThorne(), 5));
    cleanup();
    const drained = tiles(withoutRunes(createThorne()));

    // Расходятся они тем, что смыслового цвета не требует: знаком, самим числом и ступенью.
    expect(pool(drained, "Руны").text).not.toBe(pool(full, "Руны").text);
    expect(pool(drained, "Очки").text).not.toBe(pool(full, "Очки").text);
  });
});

