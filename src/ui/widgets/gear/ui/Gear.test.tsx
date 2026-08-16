// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import type { CharacterState } from "@/core/domain/assembly/state";
import type { ItemDefinition } from "@/core/domain/items/schema";
import { toBagView } from "@/core/presentation/views/bagView";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { Gear } from "./Gear";

/** Карточки, по которым идёт игра: требование вещи называет карточка, а не вещь. */
const spells = loadThorneSpells();

afterEach(cleanup);

/** Перечни строит настоящий презентер: подделка рядом проверяла бы себя, а не приложение. */
const { stats } = toChoicesView();

const NOOP = {
  stats,
  onOpenItem: () => {},
  onAddItem: () => {},
  onAdjustWornCount: () => {},
};

/** Персонаж с добавленной вещью и её запасами — поверх обычного снаряжения Торна. */
function withStock(
  definition: ItemDefinition,
  counts: { bag?: number; worn?: number },
): CharacterState {
  const state = createThorne();
  const stock = (count: number | undefined) =>
    count === undefined || count === 0 ? [] : [{ itemId: definition.id, count }];
  return {
    ...state,
    itemDefinitions: [...state.itemDefinitions, definition],
    equipment: {
      ...state.equipment,
      bag: [...state.equipment.bag, ...stock(counts.bag)],
      worn: [...state.equipment.worn, ...stock(counts.worn)],
    },
  };
}

const ring: ItemDefinition = {
  id: "ring-of-protection",
  nameRu: "Кольцо защиты",
  kind: "gear",
  bonuses: { armorClass: 1 },
};

describe("экран «Экипировка»", () => {
  it("держит защиту, надетое и запас порознь (FR-249)", () => {
    render(<Gear bag={toBagView(createThorne(), spells)} {...NOOP} />);

    expect(screen.getByRole("heading", { name: "Защита" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "На мне" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Про запас" })).toBeDefined();

    // Число стоит там, где его двигают, — и называет доспех, по которому считается.
    expect(screen.getByText(/КД 14/)).toBeDefined();
    expect(screen.getByText(/без доспехов/)).toBeDefined();

    // Надетое Торна стоит в своём разделе, и прибавка вещи читается целиком.
    const worn = screen.getByRole("list", { name: "На мне" });
    const cloak = within(worn).getByText("Плащ защиты").closest("li");
    expect(cloak?.textContent).toContain("+1 Класс Доспеха, Все спасброски");
    expect(cloak?.textContent).toContain("надето 1");

    // Счётного и денег в режиме нет: их считают, а не надевают.
    expect(screen.queryByRole("heading", { name: "Деньги" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Расходники" })).toBeNull();
  });

  it("надетое снимается из своего раздела, запас надевается из своего (FR-249)", async () => {
    const user = userEvent.setup();
    const onAdjustWornCount = vi.fn();
    render(
      <Gear bag={toBagView(withStock(ring, { bag: 1 }), spells)} {...NOOP} onAdjustWornCount={onAdjustWornCount} />,
    );

    await user.click(screen.getByRole("button", { name: "Надеть один: Кольцо защиты" }));
    expect(onAdjustWornCount).toHaveBeenCalledWith("ring-of-protection", 1);

    await user.click(screen.getByRole("button", { name: "Снять один: Плащ защиты" }));
    expect(onAdjustWornCount).toHaveBeenLastCalledWith("cloak-of-protection", -1);
  });

  it("надеть нечего — глагола нет вовсе, а не погашенным (FR-249)", () => {
    render(<Gear bag={toBagView(createThorne(), spells)} {...NOOP} />);

    // Плащ надет, и запаса у него нет: надевать нечего, и кнопки нет — причину погашенной на
    // строке назвать нечем.
    expect(screen.queryByRole("button", { name: "Надеть один: Плащ защиты" })).toBeNull();
    expect(screen.getByRole("button", { name: "Снять один: Плащ защиты" })).toBeDefined();
  });

  it("часть надета, часть про запас — вещь стоит в обоих разделах со своим числом (FR-249)", () => {
    render(<Gear bag={toBagView(withStock(ring, { bag: 7, worn: 3 }), spells)} {...NOOP} />);

    const worn = within(screen.getByRole("list", { name: "На мне" }));
    const spare = within(screen.getByRole("list", { name: "Про запас" }));

    expect(worn.getByText("надето 3")).toBeDefined();
    expect(spare.getByText("в сумке 7")).toBeDefined();
    // Каждому разделу — свой глагол, и оба у одной вещи есть.
    expect(worn.getByRole("button", { name: "Снять один: Кольцо защиты" })).toBeDefined();
    expect(spare.getByRole("button", { name: "Надеть один: Кольцо защиты" })).toBeDefined();
  });

  it("быстрый ввод заводит экипировку в запас (FR-249)", async () => {
    const user = userEvent.setup();
    const onAddItem = vi.fn();
    render(<Gear bag={toBagView(createThorne(), spells)} {...NOOP} onAddItem={onAddItem} />);

    await user.type(screen.getByLabelText("Новая экипировка"), "Кольцо защиты{Enter}");
    expect(onAddItem).toHaveBeenCalledWith("gear", "Кольцо защиты");
  });

  it("кончившаяся вещь остаётся строкой с нулём: убирают её из шторки, а не с экрана", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    render(<Gear bag={toBagView(withStock(ring, {}), spells)} {...NOOP} onOpenItem={onOpenItem} />);

    const spare = within(screen.getByRole("list", { name: "Про запас" }));
    expect(spare.getByText("в сумке 0")).toBeDefined();

    await user.click(spare.getByRole("button", { name: "Открыть: Кольцо защиты" }));
    expect(onOpenItem).toHaveBeenCalledWith("ring-of-protection");
  });
});
