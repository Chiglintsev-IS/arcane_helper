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

import { renderWithStores, shown } from "@/ui/app/testing/stores";
import { SheetScreen } from "@/ui/screens/sheet/ui/SheetScreen";

describe("«Лист» (FR-230, FR-231, FR-227)", () => {
  it("«Лист» показывает персонажа целиком и ничего из боя (FR-230)", async () => {
    await renderWithStores(<SheetScreen />);

    // Лист — база персонажа одной колонкой: кто он и его отметки.
    expect(screen.getByRole("heading", { name: "Кто он" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Отметки мастера" })).toBeDefined();
    // Ни шапки, ни списка, ни отметок схватки: лист отвечает, кто он, а не что он делает сейчас.
    expect(screen.queryByLabelText("Ресурсы")).toBeNull();
    expect(screen.queryByLabelText(/^Заклинания/)).toBeNull();
    // Чисел боя на листе нет: они стоят в шапке «Игры», а перебивки — в отметках мастера.
    expect(screen.queryByRole("heading", { name: "Числа боя" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Здоровье" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Класс Доспеха" })).toBeNull();
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

    const intelligence = shown(stores).sheet.abilities.find(
      (ability) => ability.id === "intelligence",
    );
    expect(intelligence?.score).toBe(20);
    // Магия стала компетентностью; навык чужой характеристики правкой Интеллекта не задет.
    expect(intelligence?.skills.find((skill) => skill.id === "arcana")?.training).toBe("expert");
    expect(
      shown(stores)
        .sheet.abilities.flatMap((ability) => ability.skills)
        .filter((skill) => skill.training !== undefined)
        .map((skill) => skill.id),
    ).toEqual(["arcana", "investigation", "nature", "perception"]);
    // Одна запись журнала на весь блок, а не три.
    expect(shown(stores).journal).toHaveLength(1);
    expect(screen.queryByRole("dialog", { name: "Правка: Интеллект" })).toBeNull();
    expect(screen.getByText("20 (+5)")).toBeDefined();
  });

  it("«Лист»: постоянный вклад заводится одной шторкой и двигает число (FR-246)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    await user.click(screen.getByRole("button", { name: "Править: Постоянные вклады" }));

    await user.type(screen.getByLabelText("Откуда"), "Дар богов");
    await user.selectOptions(screen.getByLabelText("Величина"), "spellSaveDc");
    const field = screen.getByLabelText("Число");
    await user.clear(field);
    await user.type(field, "2");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(shown(stores).sheet.permanentContributions).toEqual([
      { nameRu: "Дар богов", stat: "spellSaveDc", kind: "bonus", value: 2 },
    ]);
    expect(screen.getByText("Дар богов")).toBeDefined();
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

    expect(shown(stores).sheet.level).toBe(8);
    expect(shown(stores).resources.slots.find((slot) => slot.level === 4)).toEqual({
      level: 4,
      maximum: 2,
      remaining: 2,
    });
    expect(shown(stores).journal).toHaveLength(1);
  });

  it("«Лист»: отмена шторки состояния не трогает", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    await user.click(screen.getByRole("button", { name: "Править: Отметки мастера" }));
    await user.click(screen.getByRole("radio", { name: "Ступень 3" }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(shown(stores).sheet.exhaustion).toBe(0);
    expect(shown(stores).journal).toHaveLength(0);
  });


  it("«Лист»: отказ владельца остаётся в шторке причиной, а состояние не трогает", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    const before = shown(stores).sheet.abilities;

    await user.click(screen.getByRole("button", { name: "Править: Интеллект" }));
    const field = screen.getByLabelText("Значение");
    await user.clear(field);
    await user.type(field, "40");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    // Шторка не решала, бывает ли сорок: она передала число и показывает ответ персонажа.
    expect(screen.getByRole("alert").textContent).toContain("не годится");
    expect(screen.getByRole("dialog", { name: /Правка: Интеллект/ })).toBeDefined();
    expect(shown(stores).sheet.abilities).toEqual(before);
  });

  it("«Лист»: дробное число из шторки уходит владельцу как есть — отказ по-русски, состояние не трогает", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    const before = shown(stores).sheet.abilities;

    await user.click(screen.getByRole("button", { name: "Править: Интеллект" }));
    const field = screen.getByLabelText("Значение");
    await user.clear(field);
    await user.type(field, "12.5");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    // «12.5» не округляется и не обрезается в шторке: доходит до владельца дробным, и целость
    // числа проверяет уже он, словами по-русски, а не молчаливым «12».
    expect(screen.getByRole("alert").textContent).toContain("целое число");
    expect(screen.getByRole("dialog", { name: /Правка: Интеллект/ })).toBeDefined();
    expect(shown(stores).sheet.abilities).toEqual(before);
  });
});
