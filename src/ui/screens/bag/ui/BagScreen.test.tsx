// @vitest-environment jsdom

/**
 * «Сумка» на настоящем состоянии и настоящих операциях: моков нет.
 *
 * Сумка — счётные вещи и деньги: расходник тратится со строки, кошелёк правится итогом.
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithStores, shown } from "@/ui/app/testing/stores";
import { BagScreen } from "@/ui/screens/bag/ui/BagScreen";

describe("«Сумка» (FR-242)", () => {
  it("«Сумка»: расходник тратится и пополняется со строки, деньги правятся шторкой (FR-242)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<BagScreen />);

    await user.type(screen.getByLabelText("Новый расходник"), "Зелье лечения{Enter}");
    await user.click(screen.getByRole("button", { name: "Добавить один в сумку: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }));
    await user.click(screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }));

    // Ноль — состояние: строка осталась, минус выключен.
    expect(shown(stores).bag.items.find((item) => item.id === "зелье-лечения")?.bagCount).toBe(0);
    expect(
      screen.getByRole("button", { name: "Потратить один из сумки: Зелье лечения" }),
    ).toHaveProperty("disabled", true);

    await user.click(screen.getByRole("button", { name: "Править: Деньги" }));
    const gold = screen.getByLabelText("Золото");
    await user.clear(gold);
    await user.type(gold, "215");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(shown(stores).bag.money.find((coin) => coin.currency === "gold")?.amount).toBe(215);
    expect(shown(stores).journal.at(-1)?.summaryRu).toBe("Деньги: зм 0 → 215");
  });
});
