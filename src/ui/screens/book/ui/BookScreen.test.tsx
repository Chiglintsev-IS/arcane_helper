// @vitest-environment jsdom

/**
 * «Книга» на настоящем состоянии: моков нет.
 *
 * Книга показывает весь состав — включая долгое накладывание и ритуалы, — и говорит только о книге:
 * шапки ресурсов, действующего и отмены здесь нет.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { renderWithStores, spell } from "@/ui/app/testing/stores";
import { BookScreen } from "@/ui/screens/book/ui/BookScreen";

/** Торн, держащий «Обнаружение магии» ячейкой 1 уровня. */
function concentrating(): CharacterState {
  const character = createThorne();
  character.concentration = { spellId: "detect-magic", startedAt: "2026-07-31T18:00:00.000Z" };
  character.activeEffects = [
    {
      id: "effect-1",
      spellId: "detect-magic",
      nameRu: "Обнаружение магии",
      startedAt: "2026-07-31T18:00:00.000Z",
      duration: { type: "minutes", value: 10 },
      isConcentration: true,
      slotLevelUsed: 1,
      endConditionRu: "До конца концентрации или истечения длительности.",
    },
  ];
  return character;
}

/** Рендер книги: виден весь состав, а не то, чем можно сходить прямо сейчас. */
async function inBookMode(character?: CharacterState) {
  const user = userEvent.setup();
  const result = await renderWithStores(<BookScreen />, character);
  return { user, ...result };
}

describe("состав «Книги» (FR-217)", () => {
  it("книга не отбирает ничего", async () => {
    const user = userEvent.setup();
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

    // Набор Торна ровно на пределе, поэтому сначала освобождаем место.
    await user.click(screen.getByRole("button", { name: "Снять подготовку: Отражения" }));
    await user.click(screen.getByRole("button", { name: "Подготовить: Обнаружение магии" }));
    expect(stores.session.getState().session?.character.preparedSpellIds).toContain("detect-magic");

    await user.click(screen.getByRole("button", { name: "Снять подготовку: Обнаружение магии" }));
    expect(stores.session.getState().session?.character.preparedSpellIds).not.toContain(
      "detect-magic",
    );
  });

  it("считает подготовленное и не считает заговоры (FR-102)", async () => {
    await inBookMode();

    // Стартовый набор Торна занимает лимит целиком; четыре заговора в него не входят.
    expect(screen.getByLabelText("Подготовлено 11 из 11")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Подготовить: Луч холода/ })).toBeNull();
  });


});

describe("магия крови в списке действий (FR-207)", () => {
  it("её роль — «другое», и фильтр «Боевое» её тоже убирает", async () => {
    const user = userEvent.setup();
    // Отбор по роли живёт в «Книге»: в «Игре» полоса фильтров укладывается в один ряд без него.
    await renderWithStores(<BookScreen />);

    await user.click(screen.getByRole("button", { name: "Боевое" }));
    expect(screen.queryByRole("button", { name: /Магия крови/ })).toBeNull();
  });

});

describe("«Магия крови» в «Книге» (FR-207)", () => {
  it("стоит в списке книги сразу за заговорами: очки покупают вне боя", async () => {
    await inBookMode();

    const list = screen.getByRole("list", { name: "Заклинания и действия" });
    const names = within(list)
      .getAllByRole("listitem")
      .map((row) => row.textContent ?? "");

    const blood = names.findIndex((text) => text.startsWith("Магия крови"));
    const firstLevelled = names.findIndex((text) => text.startsWith("Щит"));
    expect(blood).toBeGreaterThan(-1);
    expect(blood).toBeLessThan(firstLevelled);
  });

  it("«Без ячейки» её оставляет, уровень ячейки — прячет (FR-212)", async () => {
    const user = userEvent.setup();
    await inBookMode();

    await user.click(screen.getByRole("button", { name: "Без ячейки" }));
    expect(screen.getByRole("button", { name: /Магия крови/ })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Без ячейки" }));
    await user.click(screen.getByRole("button", { name: "1 ур." }));
    expect(screen.queryByText("Магия крови")).toBeNull();
  });

  it("«Подготовлено» её не прячет: подготовка к обмену не относится", async () => {
    const user = userEvent.setup();
    await inBookMode();

    await user.click(screen.getByRole("button", { name: "Подготовлено" }));

    expect(screen.getByRole("button", { name: /Магия крови/ })).toBeDefined();
  });

});

describe("краткая карточка (FR-010)", () => {
  it("накладывание дольше хода называет точное время, а не категорию (FR-033)", async () => {
    await inBookMode();
    const row = screen.getByRole("button", { name: /Починка/ });

    expect(within(row).getByText("Накладывать 1 минуту")).toBeDefined();
    expect(within(row).queryByText("Минуты")).toBeNull();
  });

  it("у заговора цена названа во всех режимах: строка не молчит о стоимости (FR-010)", async () => {
    await inBookMode();

    // Цена названа один раз: значок «Заговор» повторял бы строку «Без ячейки» тем же словом.
    const row = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(row.getByText(/Без ячейки/)).toBeDefined();
    expect(row.queryByText("Заговор")).toBeNull();
    expect(row.queryByText(/Ячейка/)).toBeNull();
  });

  it("неподготовленный ритуал не объясняется подготовкой (FR-103)", async () => {
    // Ритуалу подготовка не нужна, и мастер применения предложит именно ритуал. Строка списка
    // обязана назвать ту же причину, иначе она отговаривает от способа, который работает.
    const user = userEvent.setup();
    // Ритуал в бою не показывается, пока не подготовлен: сверяем причину в книге.
    await renderWithStores(<BookScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: "Ритуал" }));

    // Поиск ограничен списком: карточка концентрации в шапке названа тем же заклинанием.
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
    // Неподготовленные ритуалы в списке скрыты: показываем их фильтром.
    await inBookMode();
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /^Опознание/ }));

    const card = screen.getByRole("dialog", { name: /Опознание/ });
    expect(within(card).getByText(/Прорицание/)).toBeDefined();
    expect(
      within(card).getByText(new RegExp(spell("identify").components.materialText ?? "")),
    ).toBeDefined();
    expect(within(card).getByText(/фокусировка не заменяет/)).toBeDefined();
    expect(within(card).getByText("Без броска: эффект применяется сразу")).toBeDefined();
  });

  it("в бою карточка ритуала объявляет обычное сотворение: ритуала в бою нет (FR-208)", async () => {
    const user = userEvent.setup();
    // Способ выбирает ядро, а не карточка: в бою ритуального способа среди предложенных нет, и
    // объявление обязано предупредить, что шаблон написан под ритуал.
    await renderWithStores(<BookScreen />, createThorne(), { inFight: true });
    await user.click(screen.getByRole("button", { name: /^Опознание/ }));

    const card = screen.getByRole("dialog", { name: /Опознание/ });
    expect(within(card).getByText(/Шаблон написан для ритуального применения/)).toBeDefined();
  });

  it("вне боя ритуал остаётся способом по умолчанию: замечания о шаблоне нет", async () => {
    const { user } = await inBookMode();
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /^Опознание/ }));

    const card = screen.getByRole("dialog", { name: /Опознание/ });
    expect(within(card).queryByText(/Шаблон написан для ритуального применения/)).toBeNull();
  });

  it("строка «Разрешение» показывает общую подпись, не свою копию (FR-211)", async () => {
    const user = userEvent.setup();
    // Опознание разрешается автоматически, Луч холода — атакой заклинанием: две из трёх схем.
    await inBookMode();
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /^Опознание/ }));
    const automaticCard = screen.getByRole("dialog", { name: /Опознание/ });
    expect(within(automaticCard).getByText("Разрешение").nextElementSibling?.textContent).toBe(
      "Без броска",
    );
  });

});

describe("схема ритуала (FR-192)", () => {
  it("карточка ритуала открывает схему на полный экран", async () => {
    const user = userEvent.setup();
    // Ритуалы в списке скрыты по умолчанию: сначала фильтр, потом строка списка.
    await inBookMode();
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(
      within(screen.getByLabelText(/^Заклинания/)).getByRole("button", { name: /^Опознание/ }),
    );
    await user.click(screen.getByRole("button", { name: "Схема ритуала" }));

    expect(screen.getByRole("dialog", { name: /Схема ритуала «Опознание»/ })).toBeDefined();
  });

});

describe("«Книга» говорит только о книге (FR-217)", () => {
  it("шапки ресурсов нет: ни ячеек, ни рун, ни очков, ни костей хитов", async () => {
    await inBookMode();

    expect(screen.queryByRole("region", { name: "Ресурсы" })).toBeNull();
    expect(screen.queryByLabelText("Ячейки заклинаний")).toBeNull();
    expect(screen.queryByLabelText("Прочие ресурсы")).toBeNull();
  });

  it("действующего в книге нет: книга — только книга (FR-217)", async () => {
    await renderWithStores(<BookScreen />, concentrating());

    // Имя точное: «Концентрация» есть и у переключателя фильтров.
    expect(screen.queryByRole("button", { name: /^Концентрация:/ })).toBeNull();
    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();
  });

  it("нет ни поиска, ни «Реакций», ни отмены", async () => {
    await inBookMode();

    expect(screen.queryByRole("button", { name: "Поиск" })).toBeNull();
    expect(screen.queryByLabelText("Поиск по названию")).toBeNull();
    expect(screen.queryByRole("button", { name: "Реакции" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();
  });

  it("счётчик подготовки остаётся: он отвечает на вопрос «сколько ещё можно» (FR-214)", async () => {
    await inBookMode();
    expect(screen.getByLabelText(/^Подготовлено \d+ из \d+/)).toBeDefined();
  });

});
