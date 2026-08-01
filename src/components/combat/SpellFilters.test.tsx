// @vitest-environment jsdom

/**
 * Набор переключателей строится из книги и из режима, а не из списка всех мыслимых значений
 * (FR-002, FR-212).
 *
 * Проверяется здесь, а не на экране боя: у настоящей книги Торна сегодня нет бонусного действия и
 * есть ритуалы, поэтому обе стороны каждого условия на ней не показать. Компонент презентационный —
 * состав подаётся параметром, и обе стороны видны сразу.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
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

  it("вне боя время накладывания предлагается наравне с боем (FR-212)", () => {
    renderFilters(EVERYTHING, { mode: "camp" });

    expect(screen.getByRole("button", { name: "Действие" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Реакция" })).toBeDefined();
    // И сверх боевого набора — то, что спрашивают только вне боя.
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
  });

  it("убирает концентрацию и ритуал, когда таких заклинаний нет", () => {
    renderFilters({ ...EVERYTHING, concentration: false, ritual: false });

    expect(screen.queryByRole("button", { name: "Концентрация" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();
    // «Подготовлено» от состава книги не зависит и остаётся всегда.
    expect(screen.getByRole("button", { name: "Подготовлено" })).toBeDefined();
    // «Доступно» не остаётся: вне боя оно отбирает ровно то же, что «Подготовлено» (FR-212).
    expect(screen.queryByRole("button", { name: "Доступно" })).toBeNull();
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

  it("вне боя роли предлагаются так же, как в бою (FR-212)", () => {
    renderFilters(EVERYTHING, { mode: "camp" });

    expect(screen.getByRole("button", { name: "Боевое" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Заговор" })).toBeDefined();
  });
});

describe("уровни — отдельная прокручиваемая строка (FR-212)", () => {
  it("переключатели уровня стоят в своём контейнере «Уровень», а не в общей полосе", () => {
    renderFilters(EVERYTHING);

    const levels = within(screen.getByRole("group", { name: "Уровень" }));
    expect(levels.getByRole("button", { name: "Заговор" })).toBeDefined();
    expect(levels.getByRole("button", { name: "1 ур." })).toBeDefined();
    expect(levels.getByRole("button", { name: "2 ур." })).toBeDefined();

    // Остальные переключатели — не в контейнере уровней: он не поглощает общую полосу.
    expect(levels.queryByRole("button", { name: "Ритуал" })).toBeNull();
    expect(levels.queryByRole("button", { name: "Подготовлено" })).toBeNull();
    // А снаружи они по-прежнему есть — полоса их не потеряла.
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Подготовлено" })).toBeDefined();
  });

  it("в бою контейнера уровней нет вовсе: фильтра по уровню в бою нет (FR-212)", () => {
    renderFilters(EVERYTHING, { mode: "combat" });
    expect(screen.queryByRole("group", { name: "Уровень" })).toBeNull();
  });

  it("без уровней в книге контейнера тоже нет: показывать нечего (FR-002)", () => {
    renderFilters({ ...EVERYTHING, levels: [] });
    expect(screen.queryByRole("group", { name: "Уровень" })).toBeNull();
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
