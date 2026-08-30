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
  withoutHitDice,
  withoutRunes,
} from "@/core/infrastructure/catalog/thorne/fixtures";
import { testSnapshot } from "@/ui/app/testing/stores";
import { SURFACE_CONTROL, SURFACE_GROUP } from "@/ui/shared/ui/surface";
import { ResourceHeader } from "./ResourceHeader";

afterEach(cleanup);

type Tile = { text: string; classes: string };

/** Шапка на настоящем снимке: тот же презентер, что и в приложении. */
function header(character: CharacterState): HTMLElement {
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
  return screen.getByRole("region", { name: "Ресурсы" });
}

/**
 * Первый ряд шапки. Общего имени у него нет намеренно — «чем платить» солгало бы про защиту, — и
 * прогон берёт его тем же способом, каким его читает глаз: первым рядом плиток.
 */
function tileRow(shown: HTMLElement): HTMLElement {
  const row = shown.querySelector("dl");
  if (row === null) throw new Error("нет ряда плиток");
  return row;
}

/**
 * Плитка целиком — вместе со ступенью, на которой лежит: ступень названа обёрткой, а не числом
 * внутри неё, и читать её надо там же, где её и объявили.
 */
function tiles(character: CharacterState): Tile[] {
  return [...tileRow(header(character)).children].map((tile) => ({
    text: tile.textContent ?? "",
    classes: tile.className,
  }));
}

/** Плитка пула по её подписи: прогон называет ресурс словом, а не местом в ряду. */
function pool(rows: Tile[], name: string): Tile {
  const found = rows.find((row) => row.text.includes(name));
  if (found === undefined) throw new Error(`нет плитки ${name}`);
  return found;
}

describe("шапка на самом узком экране", () => {
  /**
   * Ширины в jsdom нет, и пиксели меряет прогон браузера на 320 × 568. Здесь стоит то, из чего эта
   * ширина складывается: сколько в ряду названо и сколько в нём нажимаемых мест. Нажимаемое место
   * уже наименьшего размера нажатия не бывает, и заведённое на каждый уровень ячейки оно занимало
   * бы ряд целиком — последней плитке места не осталось бы.
   */
  it("первый ряд умещает четыре плитки, а ячейки идут своим рядом во всю ширину", () => {
    const row = header(createThorne());

    for (const named of ["КД", "Хиты", "Руны", "Кости"]) {
      expect(row.textContent).toContain(named);
    }
    // Ячеек в первом ряду нет: они забрали себе весь второй, и пятый уровень встанет в него пятым.
    expect(tileRow(row).textContent).not.toContain("1 ур.");

    // Дверь правки одна на ресурс: у КД, хитов и рун она своя, ячейки всех уровней ведут в одну на
    // всех, а кости правки не имеют вовсе — их двигают отдых и обмен кровью.
    expect(within(row).getAllByRole("button")).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: /Ячейки 1 уровня/ }).textContent,
    ).toContain("4 ур.");
  });

  it("тихая строка называет то, что за бой не меняется, и правки не обещает", () => {
    header(createThorne());

    // Ступени и плитки у неё нет: плитка обещала бы, что за ней что-то делают, а делать здесь нечего.
    expect(screen.getByText("Скорость").closest("div")?.textContent).toContain("30 футов");
    expect(screen.getByText("Размер").closest("div")?.textContent).toContain("Средний");
    // Подпись короче полного имени: на 320 пикселях полное имя забирает целую строку. Пропасть
    // из-за этого имя не вправе — короткая подпись видна глазу, полная слышна голосу.
    const perception = screen.getByText("Пассивная внимательность").closest("div");
    expect(perception?.textContent).toContain("Внимательность");
    expect(perception?.textContent).toContain("14");
  });
});

describe("ступень плитки отвечает, метит ли в неё палец", () => {
  it("нажимаемая плитка лежит на ступени нажимаемого", () => {
    const full = tiles(createThorne());

    // Руны ведут в ту же шторку, что и ячейки: одна дверь — одна шкура, а не две.
    expect(pool(full, "Руны").classes).toContain(SURFACE_CONTROL);

    // Кости не нажимаются: их двигает отдых, и ступень у них — группы.
    expect(pool(full, "Кости").classes).toContain(SURFACE_GROUP);
    expect(pool(full, "Кости").classes).not.toContain(SURFACE_CONTROL);

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
    const full = tiles(createThorne());

    // Полный пул называет ресурс и остаток: знак при нём повторял бы то, что уже сказано числом.
    expect(pool(full, "Кости").text).toContain("Кости d67/7");
    expect(pool(full, "Руны").text).toContain("Руны3/3");

    cleanup();
    const drained = tiles(withoutRunes(withoutHitDice(createThorne())));

    // Платить нечем ни одним из двух — и это видно знаком, а не только цифрой. Знак встаёт при
    // числе: подпись называет ресурс, и ширина плитки на исходе пула не меняется.
    expect(pool(drained, "Кости").text).toContain("Кости d6✗ 0/7");
    expect(pool(drained, "Руны").text).toContain("Руны✗ 0/3");
  });

  it("пул не занимает смыслового цвета: зелёная руна читалась бы как ритуал", () => {
    const full = tiles(createThorne());

    for (const name of ["Кости", "Руны"]) {
      for (const tone of ["ritual", "action", "reaction", "concentration", "bonus"]) {
        expect(pool(full, name).classes).not.toContain(tone);
      }
    }
  });

  it("постоянный цвет обещал бы остаток: пустой пул и полный не совпадают ничем", () => {
    const full = tiles(createThorne());
    cleanup();
    const drained = tiles(withoutRunes(createThorne()));

    // Расходятся они тем, что смыслового цвета не требует: знаком, самим числом и ступенью.
    expect(pool(drained, "Руны").text).not.toBe(pool(full, "Руны").text);
  });
});
