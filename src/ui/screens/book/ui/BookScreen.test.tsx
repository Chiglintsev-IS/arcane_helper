// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { renderWithStores, shown, spell } from "@/ui/app/testing/stores";
import { BookScreen } from "@/ui/screens/book/ui/BookScreen";

function concentrating(): CharacterState {
  return {
    ...createThorne(),
    concentration: { spellId: "detect-magic", startedAt: "2026-07-31T18:00:00.000Z" },
    activeEffects: [
      {
        id: "effect-1",
        spellId: "detect-magic",
        nameRu: "Обнаружение магии",
        startedAt: "2026-07-31T18:00:00.000Z",
        duration: { type: "minutes", value: 10 },
        isConcentration: true,
        slotLevelUsed: 1,
        contributions: [],
        endConditionRu: "До конца концентрации или истечения длительности.",
      },
    ],
  };
}

async function inBookMode(character?: CharacterState) {
  const user = userEvent.setup();
  const result = await renderWithStores(<BookScreen />, character);
  return { user, ...result };
}

describe("состав «Книги» (FR-217)", () => {
  it("книга не отбирает ничего", async () => {
    await renderWithStores(<BookScreen />);

    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Щит")).toBeDefined();
    expect(list.getByText("Починка")).toBeDefined();
  });
});

describe("фильтры (FR-002, FR-003, AC-07)", () => {
  it("в «Книге» переключателя «Доступно» нет: он повторял бы «Подготовлено» (FR-212)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<BookScreen />);
    const sheet = screen.queryByRole("dialog", { name: "Бой закончен?" });
    if (sheet !== null) await user.click(within(sheet).getByRole("button", { name: "Нет, продолжается" }));

    expect(screen.getByRole("button", { name: "Подготовлено" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Доступно" })).toBeNull();
  });
});

describe("режим «Привал» и операции отдыха (FR-215, FR-237)", () => {
  it("в книге привала нет: там читают, а не отдыхают", async () => {
    await inBookMode();
    expect(screen.queryByRole("button", { name: /Долгий отдых/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Прошёл час/ })).toBeNull();
  });
});

describe("подготовка в «Книге» (FR-214, FR-101)", () => {
  it("отмечает и снимает подготовку прямо в списке", async () => {
    const user = userEvent.setup();
    const { stores } = await inBookMode();

    await user.click(screen.getByRole("button", { name: "Снять подготовку: Крепость интеллекта" }));
    await user.click(screen.getByRole("button", { name: "Подготовить: Обнаружение магии" }));
    expect(shown(stores).spells.filter((row) => row.prepared).map((row) => row.id)).toContain("detect-magic");

    await user.click(screen.getByRole("button", { name: "Снять подготовку: Обнаружение магии" }));
    expect(shown(stores).spells.filter((row) => row.prepared).map((row) => row.id)).not.toContain(
      "detect-magic",
    );
  });

  it("в бою счётчик называет причину (FR-214, FR-217)", async () => {
    await renderWithStores(<BookScreen />, createThorne(), { inFight: true });

    expect(screen.queryByRole("button", { name: /^Подготовить: / })).toBeNull();
    expect(screen.getByLabelText(/^Подготовлено \d+ из \d+/).textContent).toContain(
      "Подготовку меняют вне боя",
    );
  });

  it("причина дописана к счёту и не повторяет его чисел (FR-214)", async () => {
    const { user } = await inBookMode();

    await user.click(screen.getByRole("button", { name: "Подготовить: Обнаружение магии" }));

    const line = screen.getByLabelText(/^Подготовлено \d+ из \d+/).textContent ?? "";
    expect(line).toBe("11 из 11 · Снимите другое заклинание");
  });

  it("считает подготовленное и не считает заговоры (FR-102)", async () => {
    await inBookMode();

    expect(screen.getByLabelText("Подготовлено 11 из 11")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Подготовить: Луч холода/ })).toBeNull();
  });
});

describe("последняя подсказка в списке действий (FR-329)", () => {
  it("хода она не занимает, и переключатель времени её не находит", async () => {
    const user = userEvent.setup();
    await renderWithStores(<BookScreen />);

    expect(screen.getByRole("button", { name: /Последняя подсказка/ })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Действие" }));
    expect(screen.queryByRole("button", { name: /Последняя подсказка/ })).toBeNull();
  });
});

describe("краткая карточка (FR-010)", () => {
  it("накладывание дольше хода называет точное время, а не категорию (FR-033)", async () => {
    await inBookMode();
    const row = screen.getByRole("button", { name: /Починка/ });

    expect(within(row).getByText(/1 минута/)).toBeDefined();
    expect(within(row).queryByText(/Минуты/)).toBeNull();
  });

  it("у заговора цена названа во всех режимах: строка не молчит о стоимости (FR-010)", async () => {
    await inBookMode();

    const row = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(row.getByText(/бесплатно/)).toBeDefined();
    expect(row.queryByText("Заговор")).toBeNull();
    expect(row.queryByText(/ячейка/)).toBeNull();
  });

  it("неподготовленный ритуал не объясняется подготовкой (FR-103)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<BookScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: "Ритуал" }));

    const row = within(screen.getByLabelText(/^Заклинания/)).getByRole("button", {
      name: /^Обнаружение магии/,
    });
    expect(within(row).queryByText(/Заклинание не подготовлено/)).toBeNull();
    expect(within(row).getByText(/Уже идёт концентрация/)).toBeDefined();
  });
});

describe("подробная карточка (FR-011, FR-012)", () => {
  it("открывается по строке списка и показывает механику", async () => {
    const user = userEvent.setup();
    await inBookMode();
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /^Сигнал тревоги/ }));

    const card = screen.getByRole("dialog", { name: /Сигнал тревоги/ });
    expect(within(card).getByText(/Ограждение/)).toBeDefined();
    const mechanics = within(within(card).getByLabelText("Механика"));
    expect(
      mechanics.getByText(new RegExp(spell("alarm").components.materialText ?? "")),
    ).toBeDefined();
    expect(mechanics.getByText("Сотворение").nextElementSibling).not.toBeNull();
    expect(mechanics.getByText("Действует").nextElementSibling).not.toBeNull();
  });

  it("строка броска без броска подписана «Бросок» и показывает общую подпись (FR-211)", async () => {
    const user = userEvent.setup();
    await inBookMode();
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /^Сигнал тревоги/ }));
    const automaticCard = screen.getByRole("dialog", { name: /Сигнал тревоги/ });
    expect(within(automaticCard).getByText("Бросок").nextElementSibling?.textContent).toBe(
      "Без броска",
    );
  });
});

describe("схема ритуала (FR-192)", () => {
  it("карточка ритуала открывает схему на полный экран", async () => {
    const user = userEvent.setup();
    await inBookMode();
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(
      within(screen.getByLabelText(/^Заклинания/)).getByRole("button", {
        name: /^Сигнал тревоги/,
      }),
    );
    await user.click(screen.getByRole("button", { name: "Схема ритуала" }));

    expect(screen.getByRole("dialog", { name: /Схема ритуала «Сигнал тревоги»/ })).toBeDefined();
  });
});

describe("«Книга» говорит только о книге (FR-217)", () => {
  it("шапки ресурсов нет: ни ячеек, ни рун, ни очков, ни костей хитов", async () => {
    await inBookMode();

    expect(screen.queryByRole("region", { name: "Ресурсы" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Ячейки 1 уровня/ })).toBeNull();
    expect(screen.queryByLabelText("Прочие ресурсы")).toBeNull();
  });

  it("действующего в книге нет: книга — только книга (FR-217)", async () => {
    await renderWithStores(<BookScreen />, concentrating());

    expect(screen.queryByRole("button", { name: /^Концентрация:/ })).toBeNull();
    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();
  });

  it("нет ни «Реакций», ни отмены", async () => {
    await inBookMode();

    expect(screen.queryByRole("button", { name: /^Реакции/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Вернуть/ })).toBeNull();
  });

  it("поиск здесь есть, и поля он не держит (FR-303, ADR-0058)", async () => {
    await inBookMode();

    expect(screen.getByRole("button", { name: "Поиск по названию" })).toBeDefined();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("счётчик подготовки остаётся: он отвечает на вопрос «сколько ещё можно» (FR-214)", async () => {
    await inBookMode();
    expect(screen.getByLabelText(/^Подготовлено \d+ из \d+/)).toBeDefined();
  });
});
