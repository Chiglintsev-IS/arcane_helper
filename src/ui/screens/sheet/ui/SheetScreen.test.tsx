// @vitest-environment jsdom

/**
 * «Лист» на настоящем состоянии и настоящих операциях: моков нет.
 *
 * Лист — база персонажа целиком и ничего из боя: правка доходит до состояния и до журнала, а
 * отменённая шторка не оставляет следа.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithStores } from "@/ui/app/testing/stores";
import { SheetScreen } from "@/ui/screens/sheet/ui/SheetScreen";

describe("«Лист» (FR-230, FR-231, FR-227)", () => {
  it("«Лист» показывает персонажа целиком и ничего из боя (FR-230)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);

    // Лист — база персонажа одной колонкой: кто он и его здоровье.
    expect(screen.getByRole("heading", { name: "Кто он" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Здоровье" })).toBeDefined();
    // Ни шапки, ни списка, ни отметок схватки: лист отвечает, кто он, а не что он делает сейчас.
    expect(screen.queryByLabelText("Ресурсы")).toBeNull();
    expect(screen.queryByLabelText(/^Заклинания/)).toBeNull();
    // Чисел боя на листе нет: они стоят в шапке «Игры», а перебивки — в отметках мастера.
    expect(screen.queryByRole("heading", { name: "Числа боя" })).toBeNull();
  });

  it("«Лист»: правка характеристики доходит до состояния и в журнал (FR-231)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    await user.click(screen.getByRole("button", { name: "Править: Интеллект" }));

    const field = screen.getByLabelText("Значение");
    await user.clear(field);
    await user.type(field, "20");
    // Владение навыком ставится там же, где значение: на листе это один блок.
    const arcana = within(screen.getByRole("radiogroup", { name: "Магия" }));
    await user.click(arcana.getByRole("radio", { name: "компетентность" }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const after = stores.session.getState().session;
    expect(after?.character.abilities.intelligence).toBe(20);
    // Магия стала компетентностью; навык чужой характеристики правкой Интеллекта не задет.
    expect(after?.character.skills).toEqual({
      arcana: "expert",
      investigation: "proficient",
      nature: "proficient",
      perception: "proficient",
    });
    // Одна запись журнала на весь блок, а не три.
    expect(after?.journal).toHaveLength(1);
    expect(screen.queryByRole("dialog", { name: "Правка: Интеллект" })).toBeNull();
    expect(screen.getByText("20 (+5)")).toBeDefined();
  });

  it("«Лист»: перебивка выбирается из чисел боя и снимается возвратом к формуле (FR-225)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    await user.click(screen.getByRole("button", { name: "Править: Перебивки" }));
    await user.click(screen.getByRole("button", { name: /^КС спасброска/ }));

    // Формулу шторке отдаёт лист: экран не собирает её вход заново, чтобы узнать счёт.
    expect(screen.getByText("По формуле — 16.")).toBeDefined();
    const field = screen.getByLabelText("Значение");
    await user.clear(field);
    await user.type(field, "18");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(stores.session.getState().session?.character.overrides.spellSaveDc).toBe(18);
    expect(screen.getByText("(введено руками)")).toBeDefined();
  });

  it("«Лист»: уровень пересчитывает ресурсы одной записью (FR-227)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    await user.click(screen.getByRole("button", { name: "Править: Уровень" }));

    const level = screen.getByLabelText("Уровень");
    await user.clear(level);
    await user.type(level, "8");
    const maximum = screen.getByLabelText("Базовый максимум хитов");
    await user.clear(maximum);
    await user.type(maximum, "66");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const after = stores.session.getState().session;
    expect(after?.character.level).toBe(8);
    expect(after?.character.spellSlots[4]).toEqual({ maximum: 2, remaining: 2 });
    expect(after?.journal).toHaveLength(1);
  });

  it("«Лист»: отмена шторки состояния не трогает", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    await user.click(screen.getByRole("button", { name: "Править: Отметки мастера" }));
    await user.click(screen.getByRole("radio", { name: "Ступень 3" }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(stores.session.getState().session?.character.exhaustion).toBe(0);
    expect(stores.session.getState().session?.journal).toHaveLength(0);
  });


  it("«Лист»: отказ владельца остаётся в шторке причиной, а состояние не трогает", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    const before = stores.session.getState().session?.character.hitPoints;

    await user.click(screen.getByRole("button", { name: "Править: Здоровье" }));
    const field = screen.getByLabelText("Базовый максимум");
    await user.clear(field);
    await user.type(field, "0");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    // Шторка не решала, годится ли ноль: она передала его и показывает ответ жизнеспособности.
    expect(screen.getByRole("alert").textContent).toContain("Максимум хитов");
    expect(screen.getByRole("dialog", { name: /Правка: Здоровье/ })).toBeDefined();
    expect(stores.session.getState().session?.character.hitPoints).toEqual(before);
  });
});
