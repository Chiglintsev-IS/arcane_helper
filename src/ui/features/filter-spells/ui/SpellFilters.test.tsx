// @vitest-environment jsdom

/**
 * Набор переключателей строится из того, что делит список, а не из перечня по режимам.
 *
 * Проверяется здесь, а не на «Игре»: у настоящей книги Торна сегодня нет бонусного действия, и обе
 * стороны каждого условия на ней не показать. Компонент презентационный — состав подаётся
 * параметром, и обе стороны видны сразу.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SpellFilters } from "@/ui/features/filter-spells/ui/SpellFilters";
import type { CastingTimeType } from "@/ui/entities/spell/lib/format";
import type { CombatRole } from "@/core/domain/catalog/combatRole";
import type { ScreenMode } from "@/ui/shared/model/screenMode";
import { type SpellFilters as Filters } from "@/ui/features/filter-spells/model/filters";
import { NO_FILTERS } from "@/ui/features/filter-spells/model/filters";

afterEach(cleanup);

function renderFilters(
  dividing: {
    castingTimes: CastingTimeType[];
    prices: number[];
    roles: CombatRole[];
    concentration: boolean;
    ritual: boolean;
  },
  options: { mode?: ScreenMode; filters?: Filters } = {},
) {
  render(
    <SpellFilters
      filters={options.filters ?? NO_FILTERS}
      dividing={{
        ...dividing,
        castingTimes: new Set(dividing.castingTimes),
        roles: new Set(dividing.roles),
      }}
      mode={options.mode ?? "play"}
      onChange={() => {}}
    />,
  );
}

const EVERYTHING = {
  castingTimes: ["action", "bonus_action", "reaction"] as CastingTimeType[],
  prices: [0, 1, 2],
  roles: ["offense", "defense", "other"] as CombatRole[],
  concentration: true,
  ritual: true,
};

describe("состав фильтров идёт от списка (FR-002)", () => {
  it("показывает переключатель на каждую делящую категорию", () => {
    renderFilters(EVERYTHING, { mode: "book" });

    for (const name of ["Действие", "Бонусное", "Реакция", "Боевое", "Защита", "Концентрация", "Ритуал", "Подготовлено"]) {
      expect(screen.getByRole("button", { name }), name).toBeDefined();
    }
    expect(screen.getByRole("button", { name: "Без ячейки" })).toBeDefined();
    expect(screen.getByRole("button", { name: "2 ур." })).toBeDefined();
  });

  it("в «Игре» цена не отбирает: список уже упорядочен ценой (FR-212)", () => {
    renderFilters(EVERYTHING);

    expect(screen.queryByRole("group", { name: "Цена" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Без ячейки" })).toBeNull();
    // Остальные переключатели на месте: убрана одна категория, а не полоса.
    expect(screen.getByRole("button", { name: "Концентрация" })).toBeDefined();
  });

  it("не показывает того, что список не делит", () => {
    // Ровно нынешнее состояние книги Торна: бонусного действия нет ни у одной карточки.
    renderFilters({
      castingTimes: ["action", "reaction", "minute", "hour"],
      prices: [0, 1],
      roles: ["offense", "defense", "other"],
      concentration: true,
      ritual: true,
    });

    expect(screen.queryByRole("button", { name: "Бонусное" })).toBeNull();
    expect(screen.getByRole("button", { name: "Действие" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Реакция" })).toBeDefined();
  });

  it("убирает концентрацию и ритуал, когда делить ими нечего", () => {
    renderFilters({ ...EVERYTHING, concentration: false, ritual: false });

    expect(screen.queryByRole("button", { name: "Концентрация" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();
  });

  it("роль без единой находки переключателя не получает", () => {
    // Список из одних защитных: предлагать «Боевое» значит обещать пустой результат.
    renderFilters({ ...EVERYTHING, roles: ["defense"] });

    expect(screen.getByRole("button", { name: "Защита" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Боевое" })).toBeNull();
  });
});

describe("подготовка и цена отбирают только в «Книге» (FR-212)", () => {
  it("в «Книге» переключатель есть", () => {
    renderFilters(EVERYTHING, { mode: "book" });
    expect(screen.getByRole("button", { name: "Подготовлено" })).toBeDefined();
  });

  it("в «Игре» его нет: там подготовку не меняют", () => {
    renderFilters(EVERYTHING);
    expect(screen.queryByRole("button", { name: "Подготовлено" })).toBeNull();
  });
});

describe("цена — отдельная прокручиваемая строка (FR-212)", () => {
  it("переключатели цены стоят в своём контейнере, а не в общей полосе", () => {
    renderFilters(EVERYTHING, { mode: "book" });

    const prices = within(screen.getByRole("group", { name: "Цена" }));
    expect(prices.getByRole("button", { name: "Без ячейки" })).toBeDefined();
    expect(prices.getByRole("button", { name: "1 ур." })).toBeDefined();
    expect(prices.getByRole("button", { name: "2 ур." })).toBeDefined();

    // Остальные переключатели — не в контейнере цены: он не поглощает общую полосу.
    expect(prices.queryByRole("button", { name: "Ритуал" })).toBeNull();
    expect(prices.queryByRole("button", { name: "Подготовлено" })).toBeNull();
    // А снаружи они по-прежнему есть — полоса их не потеряла.
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Подготовлено" })).toBeDefined();
  });

  it("без делящих цен контейнера нет: показывать нечего (FR-002)", () => {
    renderFilters({ ...EVERYTHING, prices: [] }, { mode: "book" });
    expect(screen.queryByRole("group", { name: "Цена" })).toBeNull();
  });
});
