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
import type { ScreenMode } from "@/ui/shared/model/screenMode";
import { type SpellFilters as Filters } from "@/ui/features/filter-spells/model/filters";
import { NO_FILTERS } from "@/ui/features/filter-spells/model/filters";

afterEach(cleanup);

/** Чем список делится: состав подаётся параметром, а не выводится из книги. */
type Dividing = {
  castingTimes: string[];
  prices: number[];
  roles: string[];
  concentration: boolean;
  ritual: boolean;
};

function renderFilters(
  dividing: Dividing,
  options: { mode?: ScreenMode; filters?: Filters; searchOpen?: boolean } = {},
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
      searchOpen={options.searchOpen ?? false}
      onChange={() => {}}
      onSearchToggle={() => {}}
    />,
  );
}

const EVERYTHING: Dividing = {
  castingTimes: ["action", "bonus_action", "reaction"],
  prices: [0, 1, 2],
  roles: ["offense", "defense", "other"],
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
    renderFilters(
      {
        castingTimes: ["action", "reaction", "minute", "hour"],
        prices: [0, 1],
        roles: ["offense", "defense", "other"],
        concentration: true,
        ritual: true,
      },
      { mode: "book" },
    );

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
    renderFilters({ ...EVERYTHING, roles: ["defense"] }, { mode: "book" });

    expect(screen.getByRole("button", { name: "Защита" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Боевое" })).toBeNull();
  });
});

describe("роль отбирает и в «Игре» (FR-212)", () => {
  it("в «Игре» роль встаёт на место времени накладывания", () => {
    renderFilters(EVERYTHING);

    expect(screen.getByRole("button", { name: "Боевое" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Защита" })).toBeDefined();
    for (const name of ["Действие", "Бонусное", "Реакция"]) {
      expect(screen.queryByRole("button", { name }), name).toBeNull();
    }

    // И ни одной кнопкой больше: полоса «Игры» задаёт четыре вопроса — где строка, зачем она,
    // держат ли её вниманием и берёт ли ритуал. Ряд над списком стоит строки списка.
    expect(screen.getAllByRole("button")).toHaveLength(5);
  });

  it("в «Книге» рядом стоят и роль, и время накладывания", () => {
    renderFilters(EVERYTHING, { mode: "book" });

    expect(screen.getByRole("button", { name: "Боевое" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Действие" })).toBeDefined();
  });

  it("знак переключателя приходит от тона, а не набирается в полосе", () => {
    renderFilters(EVERYTHING);

    // Тот же знак, что и на строке списка: два знака у одного значения читались бы как два правила.
    expect(screen.getByRole("button", { name: "Боевое" }).textContent).toBe("✚Боевое");
    expect(screen.getByRole("button", { name: "Защита" }).textContent).toBe("◇Защита");
    expect(screen.getByRole("button", { name: "Концентрация" }).textContent).toBe("◌Концентрация");
    expect(screen.getByRole("button", { name: "Ритуал" }).textContent).toBe("✦Ритуал");
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

describe("поиск стоит в полосе всегда (FR-303)", () => {
  it("кнопка есть и там, где делить список нечем", () => {
    renderFilters({
      castingTimes: [],
      prices: [],
      roles: [],
      concentration: false,
      ritual: false,
    });

    expect(screen.getByRole("button", { name: "Поиск по названию" })).toBeDefined();
  });

  it("закрытый поиск поля не показывает: постоянной высоты у него нет", () => {
    renderFilters(EVERYTHING);

    expect(screen.queryByRole("searchbox", { name: "Поиск по названию" })).toBeNull();
    expect(screen.getByRole("button", { name: "Поиск по названию" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("раскрытый показывает поле с набранным", () => {
    renderFilters(EVERYTHING, { searchOpen: true, filters: { ...NO_FILTERS, query: "молн" } });

    const field = screen.getByRole<HTMLInputElement>("searchbox", { name: "Поиск по названию" });
    expect(field.value).toBe("молн");
    expect(screen.getByRole("button", { name: "Поиск по названию" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("поле встаёт на место переключателей, а не рядом с ними", () => {
    // Полный набор в «Книге» — два ряда переключателей и шкала цены. Ряда поиск не добавляет:
    // пока набирают название, полоса состоит из лупы и поля, и больше ни из чего.
    renderFilters(EVERYTHING, { mode: "book", searchOpen: true });

    for (const name of ["Действие", "Реакция", "Боевое", "Концентрация", "Ритуал", "Подготовлено"]) {
      expect(screen.queryByRole("button", { name }), name).toBeNull();
    }
    expect(screen.queryByRole("group", { name: "Цена" })).toBeNull();
    expect(screen.getByRole("button", { name: "Поиск по названию" })).toBeDefined();
  });
});
