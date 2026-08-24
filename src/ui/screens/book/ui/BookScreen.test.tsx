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
import { renderWithStores, shown, spell } from "@/ui/app/testing/stores";
import { BookScreen } from "@/ui/screens/book/ui/BookScreen";

/** Торн, держащий «Обнаружение магии» ячейкой 1 уровня. */
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

/** Рендер книги: виден весь состав, а не то, чем можно сходить прямо сейчас. */
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

    // Набор Торна ровно на пределе, поэтому сначала освобождаем место.
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

    // Кнопок подготовки в бою нет ни одной — значит счёт обязан сказать, отчего их нет.
    expect(screen.queryByRole("button", { name: /^Подготовить: / })).toBeNull();
    expect(screen.getByLabelText(/^Подготовлено \d+ из \d+/).textContent).toContain(
      "Подготовку меняют вне боя",
    );
  });

  it("причина дописана к счёту и не повторяет его чисел (FR-214)", async () => {
    // Набор Торна занимает предел целиком: двенадцатое упирается в него без подготовки состояния.
    const { user } = await inBookMode();

    await user.click(screen.getByRole("button", { name: "Подготовить: Обнаружение магии" }));

    // Счёт стоит там же, где стоял, и назван один раз: причина дописана к нему, а не пересказывает
    // его числа второй раз. Пересказ занял бы на узком экране вторую строку.
    const line = screen.getByLabelText(/^Подготовлено \d+ из \d+/).textContent ?? "";
    expect(line).toBe("11 из 11 · Снимите другое заклинание");
  });

  it("считает подготовленное и не считает заговоры (FR-102)", async () => {
    await inBookMode();

    // Стартовый набор Торна занимает лимит целиком; четыре заговора в него не входят.
    expect(screen.getByLabelText("Подготовлено 11 из 11")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Подготовить: Луч холода/ })).toBeNull();
  });


});

describe("последняя подсказка в списке действий (FR-329)", () => {
  it("хода она не занимает, и переключатель времени её не находит", async () => {
    const user = userEvent.setup();
    await renderWithStores(<BookScreen />);

    expect(screen.getByRole("button", { name: /Последняя подсказка/ })).toBeDefined();

    // Её тратят вслед за проваленной проверкой, а не в свой ход: «Действие» ей не отвечает.
    await user.click(screen.getByRole("button", { name: "Действие" }));
    expect(screen.queryByRole("button", { name: /Последняя подсказка/ })).toBeNull();
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
    await user.click(screen.getByRole("button", { name: /^Сигнал тревоги/ }));

    const card = screen.getByRole("dialog", { name: /Сигнал тревоги/ });
    expect(within(card).getByText(/Ограждение/)).toBeDefined();
    // Материал назван и среди механики, и среди действий: первое отвечает «что это», второе — «что
    // делать сейчас», и спрашивать их приходится порознь.
    const mechanics = within(within(card).getByLabelText("Механика"));
    expect(
      mechanics.getByText(new RegExp(spell("alarm").components.materialText ?? "")),
    ).toBeDefined();
    expect(within(card).getByText("Без броска: эффект применяется сразу")).toBeDefined();
  });

  it("компонент со стоимостью назван ценой: фокусировка его не заменяет", async () => {
    // Ритуал и оплачиваемый компонент теперь у разных карточек, поэтому цену спрашивают у той,
    // которая её называет.
    const { user } = await inBookMode();
    await user.click(screen.getByRole("button", { name: /^Волшебный замок/ }));

    const card = screen.getByRole("dialog", { name: /Волшебный замок/ });
    expect(within(card).getByText(/фокусировка не заменяет/)).toBeDefined();
  });

  it("в бою карточка ритуала объявляет обычное сотворение: ритуала в бою нет (FR-208)", async () => {
    const user = userEvent.setup();
    // Способ выбирает ядро, а не карточка: в бою ритуального способа среди предложенных нет, и
    // объявление обязано предупредить, что шаблон написан под ритуал.
    await renderWithStores(<BookScreen />, createThorne(), { inFight: true });
    await user.click(screen.getByRole("button", { name: /^Сигнал тревоги/ }));

    const card = screen.getByRole("dialog", { name: /Сигнал тревоги/ });
    expect(within(card).getByText(/Шаблон написан для ритуального применения/)).toBeDefined();
  });

  it("вне боя ритуал остаётся способом по умолчанию: замечания о шаблоне нет", async () => {
    const { user } = await inBookMode();
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /^Сигнал тревоги/ }));

    const card = screen.getByRole("dialog", { name: /Сигнал тревоги/ });
    expect(within(card).queryByText(/Шаблон написан для ритуального применения/)).toBeNull();
  });

  it("строка «Разрешение» показывает общую подпись, не свою копию (FR-211)", async () => {
    const user = userEvent.setup();
    // «Сигнал тревоги» разрешается автоматически, Луч холода — атакой заклинанием: две из трёх схем.
    await inBookMode();
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /^Сигнал тревоги/ }));
    const automaticCard = screen.getByRole("dialog", { name: /Сигнал тревоги/ });
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
    expect(screen.queryByLabelText("Чем платить")).toBeNull();
    expect(screen.queryByLabelText("Прочие ресурсы")).toBeNull();
  });

  it("действующего в книге нет: книга — только книга (FR-217)", async () => {
    await renderWithStores(<BookScreen />, concentrating());

    // Имя точное: «Концентрация» есть и у переключателя фильтров.
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

    // Убран был не поиск, а его постоянный ряд: кнопка стоит в полосе, поля до нажатия нет.
    expect(screen.getByRole("button", { name: "Поиск по названию" })).toBeDefined();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("счётчик подготовки остаётся: он отвечает на вопрос «сколько ещё можно» (FR-214)", async () => {
    await inBookMode();
    expect(screen.getByLabelText(/^Подготовлено \d+ из \d+/)).toBeDefined();
  });

});
