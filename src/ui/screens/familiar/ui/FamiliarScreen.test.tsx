// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithStores } from "@/ui/app/testing/stores";
import { FamiliarScreen } from "@/ui/screens/familiar/ui/FamiliarScreen";

function rowsOf(name: string): HTMLElement[] {
  return within(screen.getByRole("list", { name })).getAllByRole("listitem");
}

describe("режим «Фамильяр»", () => {
  it("числа проверок стоят с бонусом мастерства контрактора", async () => {
    await renderWithStores(<FamiliarScreen />);

    const [herbalism, perception] = rowsOf("Чем он отвечает");

    expect(herbalism?.textContent).toContain("Травничество");
    expect(herbalism?.textContent).toContain("+5");
    expect(perception?.textContent).toContain("+6");
    expect(screen.getByText("Пассивная внимательность").parentElement?.textContent).toContain("16");
  });

  it("умения начинаются с поиска ингредиентов", async () => {
    await renderWithStores(<FamiliarScreen />);

    const traits = rowsOf("Что он умеет");

    expect(traits).toHaveLength(7);
    expect(traits[0]?.textContent).toContain("Поиск ингредиентов");
  });

  it("контракт называет обязательства Торна, а статблок — тело фрубита", async () => {
    await renderWithStores(<FamiliarScreen />);

    const obligations = rowsOf("Контракт");

    expect(obligations).toHaveLength(5);
    expect(obligations.map((row) => row.textContent).join(" ")).toMatch(/яд/);
    expect(screen.getByText("Королевский Фрубит")).toBeDefined();
    expect(screen.getByText("Класс Доспеха").parentElement?.textContent).toContain("13");
  });
});
