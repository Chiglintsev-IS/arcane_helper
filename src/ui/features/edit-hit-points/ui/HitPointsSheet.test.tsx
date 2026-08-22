// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CharacterState } from "@/core/domain/assembly/state";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { withBloodPaid, withDamage } from "@/core/infrastructure/catalog/thorne/fixtures";
import { renderWithStores, testSnapshot, type RenderWithStores } from "@/ui/app/testing/stores";
import { HitPointsSheet } from "./HitPointsSheet";

/** Кому шторка отдаёт набранное: прогон подставляет только тех, за кем следит. */
type Handlers = {
  onDamage?: (damage: number, fire: boolean) => void;
  onMaximum?: (change: { maximumBase: number; masterReduction: number }) => void;
};

/**
 * Шторка рендерится на настоящем ядре: действующий максимум от набранного считает жизнеспособность,
 * а не шторка, и приходит он ответом на вопрос.
 */
async function openHitPoints(
  character: CharacterState = createThorne(),
  handlers: Handlers = {},
): Promise<RenderWithStores> {
  const { sheet } = testSnapshot(character);
  return renderWithStores(
    <HitPointsSheet
      hitPoints={sheet.hitPoints}
      onDamage={handlers.onDamage ?? (() => {})}
      onHeal={() => {}}
      onTemporary={() => {}}
      onMaximum={handlers.onMaximum ?? (() => {})}
      onCancel={() => {}}
    />,
    character,
  );
}

/**
 * Наименьшая высота, объявленная классами элемента: стилей в прогоне нет, и сравнивать можно
 * только объявленное — зато сравнивать с тем, чья зона нажатия уже законна.
 */
function leastHeight(element: Element | null): string | undefined {
  return element?.className.split(" ").find((token) => token.startsWith("min-h-"));
}

describe("шторка хитов называет своё дело (FR-274)", () => {
  it("хиты: заголовок называет дело, и он же — имя шторки", async () => {
    await openHitPoints();

    const sheet = screen.getByRole("dialog", { name: "Хиты" });
    const title = within(sheet).getByRole("heading", { name: "Хиты" });

    // Имя шторки не вторая копия заголовка, а он сам: расходиться двум строкам здесь не с чем.
    expect(sheet.getAttribute("aria-labelledby")).toBe(title.id);
    expect(sheet.hasAttribute("aria-label")).toBe(false);

    // Случившееся за столом правкой не зовётся: этим словом зовут запись, которую сохраняют.
    expect(title.textContent).not.toContain("Правка");
  });

  it("хиты: вопрос о случившемся виден и ведёт выбор", async () => {
    await openHitPoints();

    const question = screen.getByText("Что случилось?");
    const events = screen.getByRole("radiogroup", { name: "Что случилось?" });

    // Вопрос назван один раз: слышащий его и видящий читают одну и ту же строку.
    expect(events.getAttribute("aria-labelledby")).toBe(question.id);
  });
});

describe("шторка хитов", () => {
  it("хиты: урон, лечение, временные и максимум правятся одной шторкой (FR-230)", async () => {
    await openHitPoints();

    // Максимум стоит там же, где урон: на «Листе» его нет — лист не правит того, что двигает игра.
    for (const tab of ["Урон", "Лечение", "Временные", "Максимум"]) {
      expect(screen.getByRole("radio", { name: tab })).toBeDefined();
    }
    expect(screen.queryByLabelText("Базовый максимум")).toBeNull();
  });

  it("хиты: снижение кровью названо, но не правится (FR-240)", async () => {
    // Два очка кровью — 6 хитов и столько же максимума, потом 14 хитов урона.
    const hurt = withDamage(withBloodPaid(createThorne(), 1), 14);
    await openHitPoints(hurt);
    await userEvent.click(screen.getByRole("radio", { name: "Максимум" }));

    expect(screen.getByText(/Снижение кровью — 6/)).toBeDefined();
    expect(screen.queryByLabelText("Снижение кровью")).toBeNull();
  });

  it("хиты: набранный максимум уходит владельцу, а действующий считает ядро (FR-240)", async () => {
    // Два очка кровью — 6 хитов и столько же максимума, потом 14 хитов урона.
    const onMaximum = vi.fn();
    const hurt = withDamage(withBloodPaid(createThorne(), 1), 14);
    await openHitPoints(hurt, { onMaximum });
    await userEvent.click(screen.getByRole("radio", { name: "Максимум" }));

    await userEvent.clear(screen.getByLabelText("Базовый максимум"));
    await userEvent.type(screen.getByLabelText("Базовый максимум"), "6");
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    // Меньше уже снятого кровью — отказ жизнеспособности, а не решение шторки.
    expect(onMaximum).toHaveBeenCalledWith({ maximumBase: 6, masterReduction: 0 });
  });

  it("хиты: пустое поле показывает прочерк вместо действующего максимума", async () => {
    await openHitPoints();
    await userEvent.click(screen.getByRole("radio", { name: "Максимум" }));

    await userEvent.clear(screen.getByLabelText("Базовый максимум"));

    expect(screen.getByText(/Действующий максимум станет —/)).toBeDefined();
  });

  it("пустое поле урона отказывает у поля, а не полосой", async () => {
    const onDamage = vi.fn();
    const { stores } = await openHitPoints(createThorne(), { onDamage });

    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    // Просьба не собрана: владельцу нечего отправить, и полосе ошибки нечего рассказать —
    // сырой разбор сообщения по-английски игрок не увидит, потому что до разбора дело не дошло.
    expect(onDamage).not.toHaveBeenCalled();
    expect(stores.session.getState().error).toBeNull();

    // Причина стоит у самого поля и входит в его описание — её слышит и тот, кто экран слушает.
    const field = screen.getByLabelText("Полученный урон");
    const reason = screen.getByRole("alert");
    expect(reason.textContent).toBe("Наберите число");
    expect(field.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"));
    expect(field.getAttribute("aria-invalid")).toBe("true");

    // Набранное отвечает за себя само: причина уходит с первым же прикосновением к полю.
    await userEvent.type(field, "7");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("урон огнём: отметку ставит вся строка, а не квадрат (FR-205)", async () => {
    await openHitPoints();

    // Попадают в строку, а не в квадрат: нажатие по словам ставит отметку.
    await userEvent.click(screen.getByText("Урон огнём"));
    expect(screen.getByRole("checkbox", { name: "Урон огнём", checked: true })).toBeDefined();

    // И высота строки — та же, что у кнопки записи: зона нажатия у обеих одна.
    const row = screen.getByRole("checkbox", { name: "Урон огнём" }).closest("label");
    expect(leastHeight(row)).toBe(leastHeight(screen.getByRole("button", { name: "Подтвердить" })));
  });

  it("хиты: сохранение отдаёт базу и снижение мастера", async () => {
    const onMaximum = vi.fn();
    await openHitPoints(createThorne(), { onMaximum });
    await userEvent.click(screen.getByRole("radio", { name: "Максимум" }));

    await userEvent.clear(screen.getByLabelText("Снижение мастера"));
    await userEvent.type(screen.getByLabelText("Снижение мастера"), "10");
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(onMaximum).toHaveBeenCalledWith({ maximumBase: 60, masterReduction: 10 });
  });
});
