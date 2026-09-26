// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { createWizard } from "@/core/infrastructure/catalog/thorne/fixtures";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { toSheetView } from "@/core/presentation/views/sheetView";
import { WRITTEN } from "@/ui/shared/ui/FieldForm";

import { AbilityLedger } from "./AbilityLedger";

afterEach(cleanup);

type Write = Parameters<typeof AbilityLedger>[0]["onWriteAbility"];

function show(onWriteAbility: Write = () => WRITTEN) {
  render(
    <AbilityLedger
      sheet={toSheetView(createWizard())}
      choices={toChoicesView()}
      onWriteAbility={onWriteAbility}
    />,
  );
}

describe("гроссбух бросков", () => {
  it("бонус мастерства назван один раз и над всеми числами, что его несут", () => {
    show();
    expect(screen.getByText("Бонус мастерства").textContent).toContain("+3");
    expect(screen.getAllByText("Бонус мастерства")).toHaveLength(1);
  });

  it("шапка группы — дверь правки: страница правки закрывается записью", async () => {
    const user = userEvent.setup();
    const onWriteAbility = vi.fn<Write>(() => WRITTEN);
    show(onWriteAbility);

    const header = screen.getByRole("button", {
      name: "Интеллект 18, +4, Спасбросок +8, владение. Правка: Интеллект",
    });
    await user.click(header);

    expect(screen.getByRole("dialog", { name: "Правка: Интеллект" })).toBeDefined();
    expect(screen.getByRole("radiogroup", { name: "Аркана" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onWriteAbility).toHaveBeenCalledWith(expect.objectContaining({ ability: "intelligence" }));
    expect(screen.queryByRole("radiogroup", { name: "Аркана" })).toBeNull();
    expect(screen.getByRole("list", { name: "Интеллект" })).toBeDefined();
  });

  it("владение названо словом, а не одним знаком: без слова точка ничего не значит", () => {
    show();
    const wisdom = within(screen.getByRole("list", { name: "Мудрость" }));

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
