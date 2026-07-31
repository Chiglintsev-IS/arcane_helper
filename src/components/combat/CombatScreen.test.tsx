// @vitest-environment jsdom

/**
 * Экран боя проверяется на настоящем состоянии и настоящих операциях: хранилище в памяти,
 * контент Торна, движок правил. Моков нет — иначе тест подтверждает поведение мока.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/data/content/thorne/character";
import type { CharacterState } from "@/data/schemas/character";
import { renderWithStores, spell } from "@/testing/stores";
import { CombatScreen } from "./CombatScreen";

/**
 * Торн в режиме «Книга»: виден весь состав, включая долгое накладывание и ритуалы.
 *
 * Нужен там, где проверяется сама карточка, а не отбор по режиму: в «Бою» «Починки» и «Опознания»
 * нет по FR-201, и тест о формате подписи спотыкался бы о режим (F-18).
 */
function inBookMode(): CharacterState {
  return { ...createThorne(), screenMode: "book" };
}

/**
 * Учёт хода ведётся ровно в режиме «Бой» (FR-143), а он же начальный, — так что помощник ничего не
 * включает. Имя оставлено: оно объясняет, зачем тесту учёт.
 */
function withTurnTracking(): CharacterState {
  return { ...createThorne(), screenMode: "combat" };
}

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

describe("состав экрана (FR-001, AC-14)", () => {
  it("показывает персонажа, производные числа и ячейки", async () => {
    await renderWithStores(<CombatScreen />);

    expect(screen.getByRole("heading", { name: "Торн" })).toBeDefined();
    expect(screen.getByText(/Волшебник, 7 уровень/)).toBeDefined();

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("16")).toBeDefined(); // КС спасброска
    expect(within(numbers).getByText("+8")).toBeDefined(); // атака заклинанием

    const slots = screen.getByLabelText("Ячейки заклинаний");
    expect(within(slots).getAllByRole("listitem")).toHaveLength(4);
    expect(within(slots).getByText("4/4")).toBeDefined();
  });

  it("вне боя не показывает экономию действий (FR-001, FR-143)", async () => {
    // Вне боя ходов нет: deriveTurnEconomy вернул бы «всё доступно» независимо от журнала, и
    // значки сообщали бы не состояние, а неправду.
    await renderWithStores(<CombatScreen />, { ...createThorne(), screenMode: "camp" });

    expect(screen.queryByLabelText("Действие доступно")).toBeNull();
    expect(screen.queryByLabelText("Реакция доступна")).toBeNull();
  });

  it("в бою показывает действие и реакцию, но не бонусное (FR-001)", async () => {
    // Бонусного действия нет ни у одной карточки книги — значку нечего отражать.
    await renderWithStores(<CombatScreen />, withTurnTracking());

    expect(screen.getByLabelText("Действие доступно")).toBeDefined();
    expect(screen.getByLabelText("Реакция доступна")).toBeDefined();
    expect(screen.queryByLabelText("Бонусное действие доступно")).toBeNull();
  });

  it("показывает активную концентрацию карточкой с механикой (FR-084)", async () => {
    // Состав карточки проверяется в Concentration.test.tsx; здесь — что шапка её вообще показывает.
    await renderWithStores(<CombatScreen />, concentrating());
    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
  });

  it("КД меняется после применения «Доспехов мага»: 14 → 17 (FR-093)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("14")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(within(numbers).getByText("17")).toBeDefined();
    // Вклад подписан на строке эффекта: игрок видит, откуда взялось новое число (OQ-19).
    expect(screen.getByText(/Доспехи мага · КД 17/)).toBeDefined();
  });

  it("отмена применения возвращает КД к 14", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("17")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Отменить/ }));
    expect(within(numbers).getByText("14")).toBeDefined();
  });

  it("на израсходованную реакцию отвечает «когда вернётся», а не «нет» (FR-144)", async () => {
    const character = withTurnTracking();
    character.reactionAvailable = false;
    const { stores } = await renderWithStores(<CombatScreen />, character);

    // Реакция считается потраченной по журналу: отмечаем её расход применением «Щита».
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Щит/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(stores.session.getState().session?.character.reactionAvailable).toBe(false);
    expect(screen.getByText(/вернётся в начале вашего хода/)).toBeDefined();
  });
});

describe("режимы экрана (FR-200, FR-201, FR-204)", () => {
  it("начинает с боя и не показывает долгое накладывание", async () => {
    await renderWithStores(<CombatScreen />);

    expect(screen.getByRole("radio", { name: /^Бой/ })).toHaveProperty("ariaChecked", "true");
    const list = within(screen.getByLabelText("Заклинания"));
    expect(list.getByText("Луч холода")).toBeDefined();
    expect(list.queryByText("Починка")).toBeNull();
    expect(list.queryByText("Поиск фамильяра")).toBeNull();
  });

  it("привал показывает то, чего в бою нет, и прячет мгновенное", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("radio", { name: /^Привал/ }));

    const list = within(screen.getByLabelText("Заклинания"));
    expect(list.getByText("Починка")).toBeDefined();
    expect(list.queryByText("Щит")).toBeNull();
  });

  it("книга не отбирает ничего", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));

    const list = within(screen.getByLabelText("Заклинания"));
    expect(list.getByText("Щит")).toBeDefined();
    expect(list.getByText("Починка")).toBeDefined();
  });

  it("режим попадает в состояние, а журнал не засоряет (FR-204)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("radio", { name: /^Привал/ }));

    // Сохранение — да, запись в журнал — нет: режим меняет вид, отменять в нём нечего.
    expect(stores.session.getState().session?.character.screenMode).toBe("camp");
    expect(stores.session.getState().session?.journal).toHaveLength(0);
  });

  it("в бою не предлагает фильтр «Ритуал» с ритуалами, которых там нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    // В бою ритуалы есть («Обнаружение магии» действием), поэтому переключатель на месте.
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();

    await user.click(screen.getByRole("radio", { name: /^Привал/ }));
    // На привале нет реакций — переключателя «Реакция» тоже нет (FR-002).
    expect(screen.queryByRole("button", { name: "Реакция" })).toBeNull();
  });
});

describe("фильтры (FR-002, FR-003, AC-07)", () => {
  it("фильтр по времени накладывания оставляет только подходящие заклинания", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: "Реакция" }));

    const list = screen.getByLabelText("Заклинания");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Щит")).toBeDefined();
    expect(within(list).getByText("Поглощение стихий")).toBeDefined();
  });

  it("значения одной категории соединяются «или»", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: "Реакция" }));
    await user.click(screen.getByRole("button", { name: "Действие" }));

    const list = screen.getByLabelText("Заклинания");
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(2);
    expect(within(list).getByText("Щит")).toBeDefined();
    expect(within(list).getByText("Луч холода")).toBeDefined();
  });

  it("объясняет пустой результат и предлагает сброс, а не пустой экран", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: "Реакция" }));
    await user.click(screen.getByRole("button", { name: "Заговор" }));

    expect(screen.getByText(/не подходит ни одно заклинание/)).toBeDefined();
    // Двух, а не четырёх: в режиме «Бой» из ритуалов есть только те, что творятся действием.
    expect(screen.getByText(/2 ритуалов скрыты как неподготовленные/)).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(screen.getByLabelText("Заклинания")).toBeDefined();
  });

  it("«доступно сейчас» согласовано с проверкой доступности мастера", async () => {
    const character = withTurnTracking();
    character.spellSlots = {
      1: { maximum: 4, remaining: 0 },
      2: { maximum: 3, remaining: 0 },
      3: { maximum: 3, remaining: 0 },
      4: { maximum: 1, remaining: 0 },
    };
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, character);

    await user.click(screen.getByRole("button", { name: "Доступно сейчас" }));

    const list = screen.getByLabelText("Заклинания");
    expect(within(list).queryByText("Щит")).toBeNull();
    expect(within(list).getByText("Луч холода")).toBeDefined();
  });
});

describe("краткая карточка (FR-010)", () => {
  it("показывает оба названия, уровень, время, дальность и пересказ эффекта", async () => {
    await renderWithStores(<CombatScreen />);
    const row = screen.getByRole("button", { name: /Луч холода/ });

    expect(within(row).getByText("Ray of Frost")).toBeDefined();
    expect(within(row).getByText("Заговор")).toBeDefined();
    expect(within(row).getByText("Действие")).toBeDefined();
    expect(within(row).getByText("60 футов")).toBeDefined();
    expect(within(row).getByText(spell("ray-of-frost").shortRulesRu)).toBeDefined();
  });

  it("накладывание дольше хода называет точное время, а не категорию (FR-033)", async () => {
    await renderWithStores(<CombatScreen />, inBookMode());
    const row = screen.getByRole("button", { name: /Починка/ });

    expect(within(row).getByText("1 минута")).toBeDefined();
    expect(within(row).queryByText("Минуты")).toBeNull();
  });

  it("называет минимальную стоимость применения", async () => {
    await renderWithStores(<CombatScreen />);

    // «Поглощение стихий» растёт с уровнем ячейки — «от» обещает выгоду, и она есть.
    expect(
      within(screen.getByRole("button", { name: /Поглощение стихий/ })).getByText(
        "Ячейка от 1 ур.",
      ),
    ).toBeDefined();
  });

  it("не обещает выгоды от ячейки повыше там, где её нет (FR-010)", async () => {
    // «Доспехи мага» с ячейки 3 уровня работают ровно как с первой: «от» звало бы тратить зря.
    await renderWithStores(<CombatScreen />);

    const row = within(screen.getByRole("button", { name: /Доспехи мага/ }));
    expect(row.getByText("Ячейка 1 ур.")).toBeDefined();
    expect(row.queryByText("Ячейка от 1 ур.")).toBeNull();
  });

  it("у заговора стоимость не повторяет значок «Заговор» (FR-010)", async () => {
    // «Заговор» и «Без ячейки» — одно и то же утверждение: заговор ячейку не тратит по определению.
    await renderWithStores(<CombatScreen />);

    const row = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(row.getByText("Заговор")).toBeDefined();
    expect(row.queryByText("Без ячейки")).toBeNull();
    expect(row.queryByText(/Ячейка от/)).toBeNull();
  });

  it("недоступное заклинание объясняет причину словами", async () => {
    // Ячейки 1 уровня не хватило бы: заклинание можно поднять до 4 уровня или оплатить кровью,
    // поэтому недоступным оно становится только когда не осталось ни одного способа.
    const character = withTurnTracking();
    character.spellSlots = {
      1: { maximum: 4, remaining: 0 },
      2: { maximum: 3, remaining: 0 },
      3: { maximum: 3, remaining: 0 },
      4: { maximum: 1, remaining: 0 },
    };
    await renderWithStores(<CombatScreen />, character);

    const row = screen.getByRole("button", { name: /Доспехи мага/ });
    expect(within(row).getByText(/Нет свободной ячейки 1 уровня/)).toBeDefined();
  });

  it("неподготовленный ритуал не объясняется подготовкой (FR-103)", async () => {
    // Ритуалу подготовка не нужна, и мастер применения предложит именно ритуал. Строка списка
    // обязана назвать ту же причину, иначе она отговаривает от способа, который работает.
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: "Ритуал" }));

    // Поиск ограничен списком: карточка концентрации в шапке названа тем же заклинанием (FR-084).
    const row = within(screen.getByLabelText("Заклинания")).getByRole("button", {
      name: /Обнаружение магии/,
    });
    expect(within(row).queryByText(/Заклинание не подготовлено/)).toBeNull();
    expect(within(row).getByText(/Уже идёт концентрация/)).toBeDefined();
  });
});

describe("учёт хода и отмена (FR-111, FR-143)", () => {
  it("«Мой ход начался» восстанавливает израсходованное", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CombatScreen />, withTurnTracking());

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(screen.getByText(/Действие израсходовано/)).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Мой ход начался" }));
    expect(screen.getByLabelText("Действие доступно")).toBeDefined();
    expect(stores.session.getState().session?.character.turnTracking.actionAvailable).toBe(true);
  });

  it("отмена возвращает потраченную ячейку", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(3);

    await user.click(screen.getByRole("button", { name: /^Отменить/ }));
    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(4);
    expect(stores.session.getState().session?.journal).toHaveLength(0);
  });

  it("учёт хода следует из режима, а не из переключателя (FR-143)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CombatScreen />);

    // Кнопки «Учёт хода» больше нет: она умела выключить счёт и оставить зелёные галочки.
    expect(screen.queryByRole("button", { name: "Учёт хода" })).toBeNull();
    expect(screen.getByLabelText("Действие доступно")).toBeDefined();

    await user.click(screen.getByRole("radio", { name: /^Привал/ }));
    expect(stores.session.getState().session?.character.screenMode).toBe("camp");
    expect(screen.queryByLabelText("Действие доступно")).toBeNull();
  });
});

describe("подробная карточка (FR-011, FR-012)", () => {
  it("открывается по строке списка и показывает механику", async () => {
    const user = userEvent.setup();
    // Неподготовленные ритуалы в списке скрыты: показываем их фильтром (F-09).
    await renderWithStores(<CombatScreen />, inBookMode());
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /Опознание/ }));

    const card = screen.getByRole("dialog", { name: /Опознание/ });
    expect(within(card).getByText(/Прорицание/)).toBeDefined();
    expect(
      within(card).getByText(new RegExp(spell("identify").components.materialText ?? "")),
    ).toBeDefined();
    expect(within(card).getByText(/фокусировка не заменяет/)).toBeDefined();
    expect(within(card).getByText("Броска нет: эффект применяется сразу")).toBeDefined();
  });

  it("полные правила и отыгрыш закрыты по умолчанию", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: /Луч холода/ }));
    const card = screen.getByRole("dialog", { name: /Луч холода/ });

    const fullRules = within(card).getByText("Полные правила").closest("details");
    const roleplay = within(card).getByText("Отыгрыш").closest("details");
    expect(fullRules?.hasAttribute("open")).toBe(false);
    expect(roleplay?.hasAttribute("open")).toBe(false);
  });

  it("техническая инструкция доступна за два нажатия (M-02)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: /Луч холода/ }));
    await user.click(screen.getByText("Как объявить"));

    expect(screen.getByText(/Атака заклинанием, модификатор \+8/)).toBeDefined();
  });

  it("заметка сохраняется в состоянии и не попадает в журнал", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: /Щит/ }));
    await user.type(screen.getByLabelText("Заметка"), "гасит и стрелу");

    expect(stores.session.getState().session?.character.spellNotes.shield).toBe("гасит и стрелу");
    expect(stores.session.getState().session?.journal).toHaveLength(0);
  });
});

describe("схема ритуала (FR-192)", () => {
  it("карточка ритуала открывает схему на полный экран", async () => {
    const user = userEvent.setup();
    // Ритуалы в списке скрыты по умолчанию (FR-103): сначала фильтр, потом строка списка.
    await renderWithStores(<CombatScreen />, inBookMode());
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(
      within(screen.getByLabelText("Заклинания")).getByRole("button", { name: /Опознание/ }),
    );
    await user.click(screen.getByRole("button", { name: "Схема ритуала" }));

    expect(screen.getByRole("dialog", { name: /Схема ритуала «Опознание»/ })).toBeDefined();
  });

  it("у неритуального заклинания кнопки схемы нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(
      within(screen.getByLabelText("Заклинания")).getByRole("button", { name: /Луч холода/ }),
    );

    expect(screen.queryByRole("button", { name: "Схема ритуала" })).toBeNull();
  });
});
