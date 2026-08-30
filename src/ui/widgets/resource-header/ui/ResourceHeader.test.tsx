// @vitest-environment jsdom

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

function tileRow(shown: HTMLElement): HTMLElement {
  const row = shown.querySelector("dl");
  if (row === null) throw new Error("нет ряда плиток");
  return row;
}

function tiles(character: CharacterState): Tile[] {
  return [...tileRow(header(character)).children].map((tile) => ({
    text: tile.textContent ?? "",
    classes: tile.className,
  }));
}

function pool(rows: Tile[], name: string): Tile {
  const found = rows.find((row) => row.text.includes(name));
  if (found === undefined) throw new Error(`нет плитки ${name}`);
  return found;
}

describe("шапка на самом узком экране", () => {
  it("первый ряд умещает четыре плитки, а ячейки идут своим рядом во всю ширину", () => {
    const row = header(createThorne());

    for (const named of ["КД", "Хиты", "Руны", "Кости"]) {
      expect(row.textContent).toContain(named);
    }
    expect(tileRow(row).textContent).not.toContain("1 ур.");

    expect(within(row).getAllByRole("button")).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: /Ячейки 1 уровня/ }).textContent,
    ).toContain("4 ур.");
  });

  it("тихая строка называет то, что за бой не меняется, и правки не обещает", () => {
    header(createThorne());

    expect(screen.getByText("Скорость").closest("div")?.textContent).toContain("30 футов");
    expect(screen.getByText("Размер").closest("div")?.textContent).toContain("Средний");
    const perception = screen.getByText("Пассивная внимательность").closest("div");
    expect(perception?.textContent).toContain("Внимательность");
    expect(perception?.textContent).toContain("14");
  });
});

describe("ступень плитки отвечает, метит ли в неё палец", () => {
  it("нажимаемая плитка лежит на ступени нажимаемого", () => {
    const full = tiles(createThorne());

    expect(pool(full, "Руны").classes).toContain(SURFACE_CONTROL);

    expect(pool(full, "Кости").classes).toContain(SURFACE_GROUP);
    expect(pool(full, "Кости").classes).not.toContain(SURFACE_CONTROL);

    cleanup();
    const drained = tiles(withoutRunes(createThorne()));

    expect(pool(drained, "Руны").classes).toContain(SURFACE_GROUP);
    expect(pool(drained, "Руны").classes).not.toContain(SURFACE_CONTROL);
  });
});

describe("пустой пул подан пустым", () => {
  it("нулевой пул подан как ноль", () => {
    const full = tiles(createThorne());

    expect(pool(full, "Кости").text).toContain("Кости d67/7");
    expect(pool(full, "Руны").text).toContain("Руны3/3");

    cleanup();
    const drained = tiles(withoutRunes(withoutHitDice(createThorne())));

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

    expect(pool(drained, "Руны").text).not.toBe(pool(full, "Руны").text);
  });
});
