// @vitest-environment jsdom

/**
 * Гроссбух на настоящей проекции: числа считает тот же презентер, что и в приложении.
 *
 * Проверяется то, что на экране проверить нечем: что нажимается вся шапка целиком, что цвет и точка
 * не остаются единственным носителем владения и что число, которое называют вслух, читается вслух.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { toSheetView } from "@/core/presentation/views/sheetView";
import { AbilityLedger } from "./AbilityLedger";

afterEach(cleanup);

function show(onEdit: (edit: unknown) => void = () => {}) {
  render(<AbilityLedger sheet={toSheetView(createThorne())} onEdit={onEdit} />);
}

describe("гроссбух бросков", () => {
  it("бонус мастерства назван один раз и над всеми числами, что его несут", () => {
    show();
    // Повторённый у каждого владения, он занял бы восемнадцать строк ради одной и той же тройки.
    expect(screen.getByText("Бонус мастерства").textContent).toContain("+3");
    expect(screen.getAllByText("Бонус мастерства")).toHaveLength(1);
  });

  it("шапка группы — дверь правки целиком, и зовётся она своими числами", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    show(onEdit);

    const header = screen.getByRole("button", {
      name: "Интеллект 18, +4, Спасбросок +8, владение. Правка: Интеллект",
    });
    await user.click(header);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0]?.[0]).toMatchObject({ block: "ability" });
  });

  it("владение названо словом, а не одним знаком: без слова точка ничего не значит", () => {
    show();
    const wisdom = within(screen.getByRole("list", { name: "Мудрость" }));

    // Знак виден глазу, слово слышно голосу: цвет и точка тут не единственный носитель.
    expect(wisdom.getByText("Внимательность").closest("li")?.textContent).toContain("владение");
    expect(wisdom.getByText("Медицина").closest("li")?.textContent).not.toContain("владение");
  });

  it("у Телосложения навыков нет — группа состоит из одной шапки", () => {
    show();
    expect(screen.queryByRole("list", { name: "Телосложение" })).toBeNull();
    expect(
      screen.getByRole("button", { name: /^Телосложение 16/ }),
    ).toBeDefined();
  });

  it("все восемнадцать навыков стоят на экране разом: «Броски» отвечают одним взглядом", () => {
    show();
    const skills = screen
      .getAllByRole("list")
      .flatMap((list) => within(list).getAllByRole("listitem"));
    expect(skills).toHaveLength(18);
  });
});
