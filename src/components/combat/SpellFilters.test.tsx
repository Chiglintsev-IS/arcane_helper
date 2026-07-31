// @vitest-environment jsdom

/**
 * Набор переключателей строится из книги и из режима, а не из списка всех мыслимых значений
 * (FR-002, FR-212).
 *
 * Проверяется здесь, а не на экране боя: у настоящей книги Торна сегодня нет бонусного действия и
 * есть ритуалы, поэтому обе стороны каждого условия на ней не показать. Компонент презентационный —
 * состав подаётся параметром, и обе стороны видны сразу.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SpellFilters } from "@/components/combat/SpellFilters";
import type { CastingTimeType } from "@/components/spell/format";
import type { CombatRole } from "@/rules/combatRole";
import { NO_FILTERS, type SpellFilters as Filters } from "@/rules/filters";
import type { ScreenMode } from "@/rules/modes";

afterEach(cleanup);

function renderFilters(
  available: {
    castingTimes: CastingTimeType[];
    levels: number[];
    roles: CombatRole[];
    concentration: boolean;
    ritual: boolean;
  },
  options: { mode?: ScreenMode; filters?: Filters } = {},
) {
  render(
    <SpellFilters
      filters={options.filters ?? NO_FILTERS}
      available={{
        ...available,
        castingTimes: new Set(available.castingTimes),
        roles: new Set(available.roles),
      }}
      mode={options.mode ?? "book"}
      onChange={() => {}}
      onReset={() => {}}
    />,
  );
}

const EVERYTHING = {
  castingTimes: ["action", "bonus_action", "reaction"] as CastingTimeType[],
  levels: [0, 1, 2],
  roles: ["offense", "defense", "other"] as CombatRole[],
  concentration: true,
  ritual: true,
};

describe("состав фильтров зависит от книги (FR-002)", () => {
  it("показывает переключатель на каждый вид, который в книге есть", () => {
    renderFilters(EVERYTHING, { mode: "combat" });

    for (const name of ["Действие", "Бонусное", "Реакция", "Концентрация"]) {
      expect(screen.getByRole("button", { name }), name).toBeDefined();
    }

    renderFilters(EVERYTHING);
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Заговор" })).toBeDefined();
    expect(screen.getByRole("button", { name: "2 ур." })).toBeDefined();
  });

  it("не показывает того, чего в книге нет", () => {
    // Ровно нынешнее состояние книги Торна: бонусного действия нет ни у одной карточки.
    renderFilters(
      {
        castingTimes: ["action", "reaction", "minute", "hour"],
        levels: [0, 1],
        roles: ["offense", "defense", "other"],
        concentration: true,
        ritual: true,
      },
      { mode: "combat" },
    );

    expect(screen.queryByRole("button", { name: "Бонусное" })).toBeNull();
    expect(screen.getByRole("button", { name: "Действие" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Реакция" })).toBeDefined();
  });

  it("вне боя времени накладывания среди фильтров нет: там нет и ходов (FR-202)", () => {
    renderFilters(EVERYTHING, { mode: "camp" });

    expect(screen.queryByRole("button", { name: "Действие" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Реакция" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
  });

  it("убирает концентрацию и ритуал, когда таких заклинаний нет", () => {
    renderFilters({ ...EVERYTHING, concentration: false, ritual: false });

    expect(screen.queryByRole("button", { name: "Концентрация" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();
    // «Подготовлено» и «Доступно сейчас» от состава книги не зависят и остаются всегда.
    expect(screen.getByRole("button", { name: "Подготовлено" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Доступно" })).toBeDefined();
  });
});

describe("фильтры боя (FR-212)", () => {
  it("в бою — только время, роль и концентрация", () => {
    renderFilters(EVERYTHING, { mode: "combat" });

    for (const name of ["Действие", "Бонусное", "Реакция", "Боевое", "Защита", "Концентрация"]) {
      expect(screen.getByRole("button", { name }), name).toBeDefined();
    }
    // Уровень, ритуальность, подготовка и «доступно сейчас» в бою не отвечают ни на один вопрос.
    for (const name of ["Заговор", "2 ур.", "Ритуал", "Подготовлено", "Доступно сейчас"]) {
      expect(screen.queryByRole("button", { name }), name).toBeNull();
    }
  });

  it("роль без единой находки переключателя не получает", () => {
    // Список из одних защитных: предлагать «Боевое» значит обещать пустой результат.
    renderFilters({ ...EVERYTHING, roles: ["defense"] }, { mode: "combat" });

    expect(screen.getByRole("button", { name: "Защита" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Боевое" })).toBeNull();
  });

  it("вне боя роли не предлагаются: там спрашивают про уровень", () => {
    renderFilters(EVERYTHING, { mode: "camp" });

    expect(screen.queryByRole("button", { name: "Боевое" })).toBeNull();
    expect(screen.getByRole("button", { name: "Заговор" })).toBeDefined();
  });
});

describe("«Сбросить» появляется, когда есть что сбрасывать", () => {
  it("без выбранных фильтров кнопки нет", () => {
    renderFilters(EVERYTHING, { mode: "combat" });
    expect(screen.queryByRole("button", { name: "Сбросить" })).toBeNull();
  });

  it("с выбранным фильтром кнопка появляется", () => {
    renderFilters(EVERYTHING, {
      mode: "combat",
      filters: { ...NO_FILTERS, roles: ["defense"] },
    });
    expect(screen.getByRole("button", { name: "Сбросить" })).toBeDefined();
  });
});
