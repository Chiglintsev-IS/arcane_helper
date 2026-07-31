// @vitest-environment jsdom

/**
 * Набор переключателей строится из книги, а не из списка всех мыслимых значений (FR-002).
 *
 * Проверяется здесь, а не на экране боя: у настоящей книги Торна сегодня нет бонусного действия и
 * есть ритуалы, поэтому обе стороны каждого условия на ней не показать. Компонент презентационный —
 * состав подаётся параметром, и обе стороны видны сразу.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SpellFilters } from "@/components/combat/SpellFilters";
import type { CastingTimeType } from "@/components/spell/format";
import { NO_FILTERS } from "@/rules/filters";

afterEach(cleanup);

function renderFilters(available: {
  castingTimes: CastingTimeType[];
  levels: number[];
  concentration: boolean;
  ritual: boolean;
}) {
  render(
    <SpellFilters
      filters={NO_FILTERS}
      available={{ ...available, castingTimes: new Set(available.castingTimes) }}
      onChange={() => {}}
      onReset={() => {}}
    />,
  );
}

const EVERYTHING = {
  castingTimes: ["action", "bonus_action", "reaction"] as CastingTimeType[],
  levels: [0, 1, 2],
  concentration: true,
  ritual: true,
};

describe("состав фильтров зависит от книги (FR-002)", () => {
  it("показывает переключатель на каждый вид, который в книге есть", () => {
    renderFilters(EVERYTHING);

    for (const name of ["Действие", "Бонусное", "Реакция", "Концентрация", "Ритуал"]) {
      expect(screen.getByRole("button", { name }), name).toBeDefined();
    }
    expect(screen.getByRole("button", { name: "Заговор" })).toBeDefined();
    expect(screen.getByRole("button", { name: "2 уровень" })).toBeDefined();
  });

  it("не показывает того, чего в книге нет", () => {
    // Ровно нынешнее состояние книги Торна: бонусного действия нет ни у одной карточки.
    renderFilters({
      castingTimes: ["action", "reaction", "minute", "hour"],
      levels: [0, 1],
      concentration: true,
      ritual: true,
    });

    expect(screen.queryByRole("button", { name: "Бонусное" })).toBeNull();
    expect(screen.getByRole("button", { name: "Действие" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Реакция" })).toBeDefined();
  });

  it("убирает концентрацию и ритуал, когда таких заклинаний нет", () => {
    renderFilters({ ...EVERYTHING, concentration: false, ritual: false });

    expect(screen.queryByRole("button", { name: "Концентрация" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();
    // «Подготовлено» и «Доступно сейчас» от состава книги не зависят и остаются всегда.
    expect(screen.getByRole("button", { name: "Подготовлено" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Доступно сейчас" })).toBeDefined();
  });
});
