// @vitest-environment jsdom

/**
 * Блок концентрации на настоящем состоянии и настоящих операциях: моков нет.
 *
 * Записи журнала проверяются через экран журнала: отмена живёт только там, и доступное имя
 * кнопки — то же самое «Отменить: <событие>».
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PlayShell as PlayScreen } from "@/ui/app/PlayShell";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { renderWithStores } from "@/ui/app/testing/stores";

/** Торн, держащий «Обнаружение магии» ячейкой 1 уровня. */
function concentrating(): CharacterState {
  const character = createThorne();
  character.concentration = { spellId: "detect-magic", startedAt: "2026-07-31T18:00:00.000Z" };
  character.activeEffects = [
    {
      id: "effect-1",
      spellId: "detect-magic",
      nameRu: "Обнаружение магии",
      type: "control",
      startedAt: "2026-07-31T18:00:00.000Z",
      duration: { type: "minutes", value: 10 },
      isConcentration: true,
      slotLevelUsed: 1,
      endConditionRu: "До конца концентрации или истечения длительности.",
    },
  ];
  return character;
}

describe("карточка концентрации в шапке (FR-082, FR-084)", () => {
  it("без концентрации карточки нет вовсе", async () => {
    // Ряд нескролящейся шапки не тратится на сообщение об отсутствии.
    await renderWithStores(<PlayScreen />);

    expect(screen.queryByLabelText("Концентрация")).toBeNull();
  });

  it("показывает название, ячейку, механику и чем сорвётся", async () => {
    await renderWithStores(<PlayScreen />, concentrating());

    const block = screen.getByLabelText("Концентрация");
    expect(within(block).getByText("Обнаружение магии")).toBeDefined();
    expect(within(block).getByText(/ячейка 1 ур\./)).toBeDefined();
    expect(within(block).getByText(/Сфера 30 футов от себя · Без броска/)).toBeDefined();
    expect(within(block).getByText(/спасбросок Телосложения \+4, КС от 10/)).toBeDefined();
  });

  it("карточка нажимаема и ведёт к подробностям", async () => {
    await renderWithStores(<PlayScreen />, concentrating());

    const card = screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ });
    await userEvent.click(card);

    expect(screen.getByRole("dialog", { name: /Концентрация/ })).toBeDefined();
  });
});

describe("лист концентрации (FR-084, FR-091)", () => {
  async function openPanel(): Promise<void> {
    await renderWithStores(<PlayScreen />, concentrating());
    await userEvent.click(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ }));
  }

  it("объясняет, как работает и чем прерывается", async () => {
    await openPanel();

    const panel = screen.getByRole("dialog", { name: /Концентрация/ });
    // Длительность ищется по всей строке шапки: те же «до 10 минут» стоят и в кратких правилах,
    // и одиночный поиск по ним нашёл бы два элемента вместо одного.
    expect(within(panel).getByText(/ячейка 1 ур\..*до 10 минут/)).toBeDefined();
    expect(within(panel).getByText(/чувствует присутствие магии/)).toBeDefined();

    const breakers = within(panel).getByLabelText("Чем прерывается");
    expect(within(breakers).getAllByRole("listitem")).toHaveLength(6);
    expect(within(breakers).getByText(/Недееспособность или смерть/)).toBeDefined();
    expect(within(breakers).getByText(/На усмотрение мастера/)).toBeDefined();
  });

  it("ведёт к полной карточке заклинания", async () => {
    await openPanel();

    await userEvent.click(screen.getByRole("button", { name: /Полные правила/ }));

    expect(screen.getByRole("dialog", { name: /Заклинание «Обнаружение магии»/ })).toBeDefined();
  });

  it("снимает концентрацию вручную и пишет это в журнал", async () => {
    await openPanel();

    await userEvent.click(screen.getByRole("button", { name: "Снять концентрацию" }));

    expect(screen.queryByLabelText("Концентрация")).toBeNull();
    expect(screen.queryByRole("dialog", { name: /Концентрация/ })).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
    expect(
      screen.getByRole("button", { name: /Отменить: Концентрация завершена: снята вручную/ }),
    ).toBeDefined();
  });
});

describe("ввод урона (FR-083, FR-180, FR-183)", () => {
  it("списывает хиты и без активной концентрации", async () => {
    await renderWithStores(<PlayScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^Хиты/ }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "12");
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByText("48/60")).toBeDefined();
    expect(screen.queryByText(/Проверка концентрации/)).toBeNull();
  });

  it("отмечает подавление особенностей огнём", async () => {
    await renderWithStores(<PlayScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^Хиты/ }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "5");
    await userEvent.click(screen.getByLabelText("Урон огнём"));
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByText(/Особенности подавлены: урон огнём/)).toBeDefined();
  });

  it("при активной концентрации предлагает проверку с готовой КС", async () => {
    await renderWithStores(<PlayScreen />, concentrating());

    await userEvent.click(screen.getByRole("button", { name: /^Хиты/ }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "24");
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    const check = screen.getByRole("dialog", { name: "Проверка концентрации" });
    expect(within(check).getByText(/КС 12/)).toBeDefined();
    expect(within(check).getByText(/нужно 8 и выше/)).toBeDefined();
  });

  it("не принимает ноль и не пишет пустую запись", async () => {
    await renderWithStores(<PlayScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^Хиты/ }));
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByText("60/60")).toBeDefined();
  });
});

describe("проверка концентрации (FR-083, FR-154)", () => {
  async function damage(
    amount: string,
    character: CharacterState = concentrating(),
    situation: { inFight?: boolean } = {},
  ): Promise<void> {
    await renderWithStores(<PlayScreen />, character, situation);
    await userEvent.click(screen.getByRole("button", { name: /^Хиты/ }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), amount);
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));
  }

  it("успех оставляет концентрацию и не пишет запись", async () => {
    await damage("24");

    await userEvent.click(screen.getByRole("button", { name: "Успех" }));

    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
    expect(screen.queryByRole("dialog", { name: "Проверка концентрации" })).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
    // Последняя запись журнала — урон, а не результат проверки.
    expect(screen.getByRole("button", { name: /Отменить: Получено урона: 24/ })).toBeDefined();
  });

  it("провал при доступной руне сначала предлагает Знаки ограждения", async () => {
    await damage("24");

    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    expect(screen.getByText(/Знаки ограждения/)).toBeDefined();
    // Эффект ещё держится: предложение обязано появиться до завершения.
    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
  });

  it("руна сохраняет концентрацию, списывая реакцию", async () => {
    // Бой отмечен начатым — значит учёт хода ведётся и трата реакции видна в шапке.
    const character = concentrating();
    await damage("24", character, { inFight: true });
    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    await userEvent.click(screen.getByRole("button", { name: "Потратить руну" }));

    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
    expect(screen.getByText(/Руны 2\/3/)).toBeDefined();
    // Значок траты реакции есть только в бою — он проверяется до ухода в журнал.
    expect(screen.getByLabelText(/Реакция израсходована/)).toBeDefined();

    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
    expect(
      screen.getByRole("button", { name: /Отменить: Знаки ограждения/ }),
    ).toBeDefined();
  });

  it("отказ от руны завершает концентрацию и эффект", async () => {
    await damage("24");
    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    await userEvent.click(screen.getByRole("button", { name: "Всё равно провал" }));

    expect(screen.queryByLabelText("Концентрация")).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
    expect(
      screen.getByRole("button", {
        name: /Отменить: Концентрация завершена: провалена проверка концентрации/,
      }),
    ).toBeDefined();
  });

  it("без руны провал завершает концентрацию сразу", async () => {
    const character = concentrating();
    character.runes = { remaining: 0, maximum: 3 };
    await damage("24", character);

    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    expect(screen.queryByLabelText("Концентрация")).toBeNull();
  });
});

describe("завершение активного эффекта (FR-091)", () => {
  it("закрывает неконцентрационный эффект и пишет это в журнал", async () => {
    const character = createThorne();
    character.activeEffects = [
      {
        id: "effect-2",
        spellId: "mage-armor",
        nameRu: "Доспехи мага",
        type: "buff",
        startedAt: "2026-07-31T18:00:00.000Z",
        duration: { type: "hours", value: 8 },
        isConcentration: false,
        slotLevelUsed: 1,
        endConditionRu: "До истечения длительности.",
      },
    ];
    await renderWithStores(<PlayScreen />, character);

    await userEvent.click(screen.getByRole("button", { name: "Завершить: Доспехи мага" }));

    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
    expect(
      screen.getByRole("button", { name: /Отменить: Эффект завершён: Доспехи мага/ }),
    ).toBeDefined();
  });
});

describe("ручной статус (FR-236)", () => {
  it("заводит статус без вклада в КД и его можно снять", async () => {
    await renderWithStores(<PlayScreen />);

    const field = screen.getByLabelText("Новый статус");
    await userEvent.type(field, "Опутанный{Enter}");

    const list = screen.getByLabelText("Активные эффекты");
    expect(within(list).getByText(/Опутанный/)).toBeDefined();
    expect(within(list).queryByText(/КД/)).toBeNull();
    // Поле готово к следующему статусу без лишнего нажатия.
    expect((field as HTMLInputElement).value).toBe("");

    await userEvent.click(screen.getByRole("button", { name: "Завершить: Опутанный" }));
    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: /^Журнал/ }));
    // Отменить можно только последнюю запись — снятие эффекта; начало осталось строкой без кнопки.
    expect(screen.getByText("Эффект начат: Опутанный")).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Отменить: Эффект завершён: Опутанный/ }),
    ).toBeDefined();
  });

  it("пустая отправка ничего не заводит", async () => {
    await renderWithStores(<PlayScreen />);

    const field = screen.getByLabelText("Новый статус");
    await userEvent.type(field, "   {Enter}");

    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();
  });
});

describe("поправка к КД (FR-236)", () => {
  it("заводится и меняет итоговый КД тем же способом, что и временные хиты", async () => {
    await renderWithStores(<PlayScreen />);

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("14")).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    const dialog = screen.getByRole("dialog", { name: "Правка КД" });
    await userEvent.type(within(dialog).getByLabelText("Поправка"), "2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Записать" }));

    expect(screen.queryByRole("dialog", { name: "Правка КД" })).toBeNull();
    expect(within(numbers).getByText("16")).toBeDefined();
    expect(within(numbers).getByRole("button", { name: /^КД 16\. Правка: поправка/ })).toBeDefined();
    expect(within(numbers).getByText("КД +2")).toBeDefined();
  });

  it("отрицательная поправка печатается типографским минусом и снижает КД", async () => {
    await renderWithStores(<PlayScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await userEvent.type(screen.getByLabelText("Поправка"), "-3");
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("11")).toBeDefined();
    expect(within(numbers).getByText("КД −3")).toBeDefined();
  });

  it("новое значение заменяет прежнее, а не складывается с ним", async () => {
    await renderWithStores(<PlayScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await userEvent.type(screen.getByLabelText("Поправка"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await userEvent.clear(screen.getByLabelText("Поправка"));
    await userEvent.type(screen.getByLabelText("Поправка"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("19")).toBeDefined();
    expect(within(numbers).getByText("КД +5")).toBeDefined();
    expect(within(numbers).queryByText("КД +2")).toBeNull();
  });

  it("ноль снимает поправку вовсе", async () => {
    await renderWithStores(<PlayScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await userEvent.type(screen.getByLabelText("Поправка"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await userEvent.clear(screen.getByLabelText("Поправка"));
    await userEvent.click(screen.getByRole("button", { name: "Записать" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("14")).toBeDefined();
    expect(within(numbers).queryByText(/КД [+−]/)).toBeNull();
  });
});
