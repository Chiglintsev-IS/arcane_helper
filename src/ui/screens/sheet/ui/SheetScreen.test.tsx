// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWithStores, shown } from "@/ui/app/testing/stores";
import { SheetScreen } from "@/ui/screens/sheet/ui/SheetScreen";

async function openIdentity(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("tab", { name: "Кто он" }));
}

describe("«Лист» (FR-230, FR-231, FR-227)", () => {
  it("открывается бросками: за столом лист открывают, чтобы назвать число (FR-230)", async () => {
    await renderWithStores(<SheetScreen />);

    expect(screen.getByRole("tab", { name: "Броски" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Бонус мастерства").textContent).toContain("+3");
    expect(screen.getByRole("button", { name: /^Интеллект 18/ })).toBeDefined();

    expect(screen.queryByLabelText("Ресурсы")).toBeNull();
    expect(screen.queryByLabelText(/^Заклинания/)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Числа боя" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Здоровье" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Класс Доспеха" })).toBeNull();
  });

  it("вторая вкладка отвечает, кто он, а не чем он бросает (FR-230)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<SheetScreen />);
    await openIdentity(user);

    expect(screen.getByRole("heading", { name: "Кто он" })).toBeDefined();
    expect(screen.getByText("Лунный тролль")).toBeDefined();
    expect(screen.queryByText("Бонус мастерства")).toBeNull();
  });

  it("отметок мастера на листе нет: их ставят в «Игре», где мастер их и называет (FR-232)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<SheetScreen />);
    await openIdentity(user);

    expect(screen.queryByRole("heading", { name: "Отметки мастера" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Правка: Отметки мастера" })).toBeNull();
  });

  it("«Лист»: правка характеристики доходит до состояния и в лог (FR-231)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    await user.click(screen.getByRole("button", { name: /^Интеллект 18/ }));

    const field = screen.getByLabelText("Значение");
    await user.clear(field);
    await user.type(field, "20");
    const arcana = within(screen.getByRole("radiogroup", { name: "Аркана" }));
    await user.click(arcana.getByRole("radio", { name: "компетентность" }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const intelligence = shown(stores).sheet.abilities.find(
      (ability) => ability.id === "intelligence",
    );
    expect(intelligence?.score).toBe(20);
    expect(intelligence?.skills.find((skill) => skill.id === "arcana")?.training).toBe("expert");
    expect(
      shown(stores)
        .sheet.abilities.flatMap((ability) => ability.skills)
        .filter((skill) => skill.training !== undefined)
        .map((skill) => skill.id),
    ).toEqual(["sleightOfHand", "arcana", "investigation", "nature", "perception", "survival"]);
    expect(shown(stores).log).toHaveLength(1);
    expect(screen.queryByRole("dialog", { name: "Правка: Интеллект" })).toBeNull();
    expect(screen.getByRole("button", { name: /^Интеллект 20, \+5/ })).toBeDefined();
  });

  it("«Лист»: языки правятся своей шторкой, а владения — своей (FR-230)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    await openIdentity(user);

    await user.click(screen.getByRole("button", { name: "Правка: Владения" }));
    await user.type(screen.getByLabelText("Инструменты"), "Инструменты кузнеца");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await user.click(screen.getByRole("button", { name: "Правка: Языки" }));
    await user.type(screen.getByLabelText("Знает"), "Общий, Троллий");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(shown(stores).sheet.proficiencies.tools).toEqual(["Инструменты кузнеца"]);
    expect(shown(stores).sheet.proficiencies.languages).toEqual(["Общий", "Троллий"]);
    expect(shown(stores).log).toHaveLength(0);
  });

  it("«Лист»: уровень пересчитывает ресурсы одной записью (FR-227)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    await openIdentity(user);
    await user.click(screen.getByRole("button", { name: "Правка: Уровень" }));

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
    expect(shown(stores).log).toHaveLength(1);
  });

  it("«Лист»: отмена шторки состояния не трогает", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    const before = shown(stores).sheet.abilities;

    await user.click(screen.getByRole("button", { name: /^Мудрость 12/ }));
    const medicine = within(screen.getByRole("radiogroup", { name: "Медицина" }));
    await user.click(medicine.getByRole("radio", { name: "компетентность" }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(shown(stores).sheet.abilities).toEqual(before);
    expect(shown(stores).log).toHaveLength(0);
  });

  it("«Лист»: отказ владельца остаётся в шторке причиной, а состояние не трогает", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    const before = shown(stores).sheet.abilities;

    await user.click(screen.getByRole("button", { name: /^Интеллект 18/ }));
    const field = screen.getByLabelText("Значение");
    await user.clear(field);
    await user.type(field, "40");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(screen.getByRole("alert").textContent).toContain("не годится");
    expect(screen.getByRole("dialog", { name: /Правка: Интеллект/ })).toBeDefined();
    expect(shown(stores).sheet.abilities).toEqual(before);
  });

  it("«Лист»: дробное число из шторки уходит владельцу как есть — отказ по-русски, состояние не трогает", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<SheetScreen />);
    const before = shown(stores).sheet.abilities;

    await user.click(screen.getByRole("button", { name: /^Интеллект 18/ }));
    const field = screen.getByLabelText("Значение");
    await user.clear(field);
    await user.type(field, "12.5");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(screen.getByRole("alert").textContent).toContain("целое число");
    expect(screen.getByRole("dialog", { name: /Правка: Интеллект/ })).toBeDefined();
    expect(shown(stores).sheet.abilities).toEqual(before);
  });
});
