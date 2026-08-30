// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { knowing } from "@/core/infrastructure/catalog/thorne/fixtures";
import { testSnapshot } from "@/ui/app/testing/stores";

import { SpellCardCompact } from "./SpellCardCompact";

afterEach(cleanup);

const SNAPSHOT = testSnapshot(knowing(createThorne(), "arcane-lock"));

function rowOf(id: string) {
  const found = SNAPSHOT.spells.find((row) => row.id === id);
  if (found === undefined) throw new Error(`нет строки ${id}`);
  return found;
}

function renderRow(id: string) {
  return render(
    <SpellCardCompact
      spell={rowOf(id)}
      casting={SNAPSHOT.casting}
      armorClass={SNAPSHOT.sheet.armorClass}
      onOpen={() => {}}
    />,
  );
}

describe("строка каста (FR-010)", () => {
  it("тип каста, цена и срок стоят одной строкой, уровень отдельно не называется", () => {
    renderRow("web");

    expect(screen.getByText(/Действие/).textContent).toContain("Действие");
    expect(screen.getByText("· ячейка 2")).toBeDefined();
    expect(screen.getByText("◉ 1 час")).toBeDefined();
    expect(screen.queryByText(/уровень/)).toBeNull();
  });

  it("растущее от ячейки зовётся «от … ↑», ритуал стоит в цене, а не чипом", () => {
    renderRow("lightning-bolt");
    expect(screen.getByText("· ячейка от 3 ↑")).toBeDefined();

    cleanup();
    renderRow("detect-magic");
    expect(screen.getByText("· ◈ ритуал")).toBeDefined();
    expect(screen.queryByText("Ритуал")).toBeNull();
  });

  it("материал со стоимостью назван в цене", () => {
    renderRow("arcane-lock");
    expect(screen.getByText("· ячейка 2 + пыль 25 зм")).toBeDefined();
  });

  it("мгновенное про срок молчит", () => {
    renderRow("ray-of-frost");
    expect(screen.queryByText(/Мгновенн/)).toBeNull();
    expect(screen.queryByText("—")).toBeNull();
  });
});

describe("бросок назван с бросающим (FR-211)", () => {
  it("атака — числом этого персонажа и по КД цели", () => {
    renderRow("ray-of-frost");
    expect(screen.getByText(/Атака d20\+8 по КД цели/)).toBeDefined();
    expect(screen.getByText("ПОПАЛ")).toBeDefined();
    expect(screen.getByText("2d8 холодом")).toBeDefined();
  });

  it("спасбросок — кто бросает, какой и против какого КС; исходы подписаны", () => {
    renderRow("rimes-binding-ice");
    expect(screen.getByText(/Каждый в конусе бросает спас ТЕЛ против КС 16/)).toBeDefined();
    expect(screen.getByText("ПРОВАЛ")).toBeDefined();
    expect(screen.getByText("УСПЕХ")).toBeDefined();
    expect(screen.getByText("3d8 холодом")).toBeDefined();
  });

  it("без броска строки броска нет вовсе", () => {
    renderRow("mage-armor");
    expect(screen.queryByText(/бросает|Атака|Без броска/)).toBeNull();
  });
});

describe("компоненты и роль", () => {
  it("компоненты стоят буквами в углу имени, только то, что требуется от игрока", () => {
    renderRow("counterspell");
    expect(screen.getByLabelText("Компоненты: Ж")).toBeDefined();

    cleanup();
    renderRow("web");
    expect(screen.getByLabelText("Компоненты: Г·Ж")).toBeDefined();

    cleanup();
    renderRow("arcane-lock");
    expect(screen.getByLabelText("Компоненты: Г·Ж·М")).toBeDefined();
  });

  it("роль — линейкой с края и словом для чтения вслух, без чипа", () => {
    const { container } = renderRow("lightning-bolt");

    const row = container.querySelector("button");
    expect(row?.className).toContain("border-l-offense");
    expect(screen.getByText(/Боевое/).className).toContain("sr-only");
  });

  it("«ни то, ни другое» линейку получает нейтральную, а не пустую", () => {
    const { container } = renderRow("detect-magic");

    const row = container.querySelector("button");
    expect(row?.className).toContain("border-l-rule-strong");
  });
});

describe("эффект и примечание", () => {
  it("обещанный КД считается готовым и стоит громкой строкой", () => {
    renderRow("mage-armor");
    expect(screen.getByText(`КД 17 вместо ${SNAPSHOT.sheet.armorClass}`)).toBeDefined();
  });

  it("триггер реакции стоит своей строкой и начинается с «когда»", () => {
    renderRow("shield");
    expect(screen.getByText(/^когда /)).toBeDefined();
  });

  it("примечание — полными предложениями, отдельной строкой", () => {
    renderRow("haste");
    expect(screen.getByText("Когда заклинание кончается, цель пропускает свой ход.")).toBeDefined();
  });
});
