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
    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Луч холода")).toBeDefined();
    expect(list.queryByText("Починка")).toBeNull();
    expect(list.queryByText("Поиск фамильяра")).toBeNull();
  });

  it("привал показывает то, чего в бою нет, и прячет мгновенное", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("radio", { name: /^Привал/ }));

    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Починка")).toBeDefined();
    expect(list.queryByText("Щит")).toBeNull();
  });

  it("книга не отбирает ничего", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));

    const list = within(screen.getByLabelText(/^Заклинания/));
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

    // Ритуалы Торна не подготовлены, значит в бою их нет — и переключателя тоже (FR-002, FR-209).
    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    // В книге ритуалы есть, а «Действия» нет: время накладывания спрашивают только в бою (FR-212).
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Действие" })).toBeNull();
  });

  it("на привале полосы фильтров нет: список короткий и отобран режимом (FR-202)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("radio", { name: /^Привал/ }));

    expect(screen.queryByLabelText("Фильтры")).toBeNull();
    expect(within(screen.getByLabelText(/^Заклинания/)).getAllByRole("listitem")).toHaveLength(5);
  });
});

describe("фильтры (FR-002, FR-003, AC-07)", () => {
  it("фильтр по времени накладывания оставляет только подходящие заклинания", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: "Реакция" }));

    const list = screen.getByLabelText(/^Заклинания/);
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    expect(within(list).getByText("Щит")).toBeDefined();
    expect(within(list).getByText("Поглощение стихий")).toBeDefined();
  });

  it("значения одной категории соединяются «или»", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: "Реакция" }));
    await user.click(screen.getByRole("button", { name: "Действие" }));

    const list = screen.getByLabelText(/^Заклинания/);
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(2);
    expect(within(list).getByText("Щит")).toBeDefined();
    expect(within(list).getByText("Луч холода")).toBeDefined();
  });

  it("объясняет пустой результат и предлагает сброс, а не пустой экран", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    // Реакций, которые при этом боевые, у Торна нет: обе его реакции — защитные.
    await user.click(screen.getByRole("button", { name: "Реакция" }));
    await user.click(screen.getByRole("button", { name: "Боевое" }));

    expect(screen.getByText(/не подходит ни одно заклинание/)).toBeDefined();
    // Про скрытые ритуалы речи нет: в боевой список неподготовленное не попадает вовсе (FR-209).
    expect(screen.queryByText(/ритуалов скрыты/)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(screen.getByLabelText(/^Заклинания/)).toBeDefined();
  });

  it("«доступно сейчас» согласовано с проверкой доступности мастера", async () => {
    // Переключатель живёт вне боя: в бою он прячет строку ровно тогда, когда игрок выясняет, чего
    // ему не хватает, — а причина написана на самой строке словами (FR-212).
    const character = inBookMode();
    character.spellSlots = {
      1: { maximum: 4, remaining: 0 },
      2: { maximum: 3, remaining: 0 },
      3: { maximum: 3, remaining: 0 },
      4: { maximum: 1, remaining: 0 },
    };
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, character);

    await user.click(screen.getByRole("button", { name: "Доступно сейчас" }));

    const list = screen.getByLabelText(/^Заклинания/);
    expect(within(list).queryByText("Щит")).toBeNull();
    expect(within(list).getByText("Луч холода")).toBeDefined();
  });
});

describe("операции привала (FR-202, FR-215)", () => {
  /** Торн на привале, потративший ячейку первого уровня: восстанавливать есть что. */
  async function atCamp(character: CharacterState = createThorne()) {
    const spent = {
      ...character,
      screenMode: "camp" as const,
      spellSlots: { ...character.spellSlots, 1: { maximum: 4, remaining: 2 } },
    };
    return renderWithStores(<CombatScreen />, spent);
  }

  it("короткий отдых доступен кнопкой и пишется в журнал", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Короткий отдых/ }));

    expect(stores.session.getState().session?.journal.at(-1)?.kind).toBe("short_rest");
  });

  it("долгий отдых требует подтверждения и возвращает ячейки (FR-133)", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Долгий отдых/ }));
    // Случайное нажатие уничтожает состояние боя, поэтому между кнопкой и отдыхом стоит выбор.
    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(2);

    await user.click(screen.getByRole("button", { name: "Отдохнуть" }));
    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(4);
  });

  it("отмена подтверждения ничего не меняет", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Долгий отдых/ }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(stores.session.getState().session?.journal).toHaveLength(0);
    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(2);
  });

  it("магическое восстановление возвращает выбранные ячейки (FR-131)", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Магическое восстановление/ }));
    await user.click(screen.getByRole("button", { name: "Вернуть ячейку 1 уровня" }));
    await user.click(screen.getByRole("button", { name: "Вернуть ячейки" }));

    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(3);
    expect(stores.session.getState().session?.character.arcaneRecoveryAvailable).toBe(false);
  });

  it("израсходованное восстановление кнопки не получает (FR-002)", async () => {
    await atCamp({ ...createThorne(), arcaneRecoveryAvailable: false });
    expect(screen.queryByRole("button", { name: /Магическое восстановление/ })).toBeNull();
  });

  it("без снижения максимума «Прошёл час» не предлагается (FR-002)", async () => {
    await atCamp();
    expect(screen.queryByRole("button", { name: /Прошёл час/ })).toBeNull();
  });

  it("«Прошёл час» возвращает часть снижённого максимума (FR-173)", async () => {
    const user = userEvent.setup();
    const reduced = createThorne();
    reduced.screenMode = "camp";
    reduced.hitPoints = { current: 51, maximum: 51, maximumReduction: 9 };
    await renderWithStores(<CombatScreen />, reduced);

    await user.click(screen.getByRole("button", { name: /Прошёл час/ }));
    // На 7 уровне возвращается 3 за час: максимум 51 → 54, текущие не растут.
    expect(screen.getByLabelText("Ресурсы").textContent).toContain("51/54");
  });

  it("вне боя нет ни кнопки хода, ни счётчика раундов (FR-202)", async () => {
    await atCamp();

    expect(screen.queryByRole("button", { name: "Мой ход начался" })).toBeNull();
    expect(screen.getByLabelText("Ресурсы").textContent).not.toContain("раунд");
  });

  it("в книге операций привала нет: там читают, а не отдыхают", async () => {
    await renderWithStores(<CombatScreen />, inBookMode());
    expect(screen.queryByRole("button", { name: /Долгий отдых/ })).toBeNull();
  });
});

describe("конец боя (FR-216)", () => {
  function wounded(): CharacterState {
    const character = createThorne();
    character.hitPoints = { current: 12, maximum: 60, maximumReduction: 0 };
    return character;
  }

  it("уход из боя с раной спрашивает и восстанавливает до половины максимума", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CombatScreen />, wounded());

    await user.click(screen.getByRole("radio", { name: /^Привал/ }));

    // Режим переключается сразу и без условий: игрок мог уйти за справкой посреди боя.
    expect(stores.session.getState().session?.character.screenMode).toBe("camp");

    await user.click(screen.getByRole("button", { name: "Да, бой закончен" }));
    expect(stores.session.getState().session?.character.hitPoints.current).toBe(30);
  });

  it("«нет, продолжается» ничего не меняет", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<CombatScreen />, wounded());

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    await user.click(screen.getByRole("button", { name: "Нет, продолжается" }));

    expect(stores.session.getState().session?.character.hitPoints.current).toBe(12);
    expect(stores.session.getState().session?.journal).toHaveLength(0);
  });

  it("при здоровье выше половины вопрос не задаётся: отвечать «да» было бы не на что", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("radio", { name: /^Привал/ }));
    expect(screen.queryByRole("dialog", { name: "Бой закончен?" })).toBeNull();
  });

  it("переход между привалом и книгой вопроса не задаёт: бой уже позади", async () => {
    const user = userEvent.setup();
    const character = wounded();
    character.screenMode = "camp";
    await renderWithStores(<CombatScreen />, character);

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.queryByRole("dialog", { name: "Бой закончен?" })).toBeNull();
  });
});

describe("магия крови в списке действий (FR-207)", () => {
  it("стоит в бою среди заклинаний и подчиняется тем же фильтрам", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    expect(screen.getByRole("button", { name: /Магия крови/ })).toBeDefined();

    // Она тратит действие, значит фильтр действия её оставляет…
    await user.click(screen.getByRole("button", { name: "Действие" }));
    expect(screen.getByRole("button", { name: /Магия крови/ })).toBeDefined();

    // …а фильтр реакции убирает: строка, остающаяся при любом фильтре, делает список лживым.
    await user.click(screen.getByRole("button", { name: "Действие" }));
    await user.click(screen.getByRole("button", { name: "Реакция" }));
    expect(screen.queryByRole("button", { name: /Магия крови/ })).toBeNull();
  });

  it("её роль — «другое», и фильтр «Боевое» её тоже убирает", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(screen.getByRole("button", { name: "Боевое" }));
    expect(screen.queryByRole("button", { name: /Магия крови/ })).toBeNull();
  });

  // Случай «строка крови осталась, а заклинаний не осталось» на нынешнем контенте недостижим:
  // «Сообщение» — заговор, и его признаки (действие, роль «другое», без концентрации) совпадают с
  // признаками обмена в точности. Экран этот случай всё равно различает: пустое сообщение
  // появляется, только когда не подошло вообще ничего.
});

describe("краткая карточка (FR-010)", () => {
  it("показывает время, цену, дальность и пересказ эффекта", async () => {
    await renderWithStores(<CombatScreen />);
    const row = screen.getByRole("button", { name: /Луч холода/ });

    // В бою значка подготовки нет, цену говорит стоимость: «Заговор» уступил место «Без ячейки».
    expect(within(row).getByText("Без ячейки")).toBeDefined();
    expect(within(row).getByText("Действие")).toBeDefined();
    expect(within(row).getByText("60 футов")).toBeDefined();
    expect(within(row).getByText(spell("ray-of-frost").shortRulesRu)).toBeDefined();
  });

  it("английское название есть вне боя и уступает место роли в бою (FR-211)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    // В бою по чужим книгам не ищут — угол занимает роль, и строка не становится выше.
    const inFight = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(inFight.getByText("Боевое")).toBeDefined();
    expect(inFight.queryByText("Ray of Frost")).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));

    const inBook = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(inBook.getByText("Ray of Frost")).toBeDefined();
    expect(inBook.queryByText("Боевое")).toBeNull();
  });

  it("разрешение называет число, а не вид броска (FR-211)", async () => {
    await renderWithStores(<CombatScreen />);

    // «Атака» — половина ответа: следом игрок спрашивает, какое число называть мастеру.
    const row = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(row.getByText("d20+8")).toBeDefined();
    expect(row.queryByText("Атака")).toBeNull();
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

  it("вне боя у заговора стоимость не повторяет значок «Заговор» (FR-010)", async () => {
    // «Заговор» и «Без ячейки» — одно и то же утверждение: заговор ячейку не тратит по определению.
    await renderWithStores(<CombatScreen />, inBookMode());

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
    // Ритуал в бою не показывается, пока не подготовлен (FR-209): сверяем причину в книге.
    await renderWithStores(<CombatScreen />, { ...concentrating(), screenMode: "book" });

    await user.click(screen.getByRole("button", { name: "Ритуал" }));

    // Поиск ограничен списком: карточка концентрации в шапке названа тем же заклинанием (FR-084).
    const row = within(screen.getByLabelText(/^Заклинания/)).getByRole("button", {
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

  it("«Щит» сам исчезает с началом следующего хода, КД возвращается к 14 (FR-094)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />, withTurnTracking());

    await user.click(screen.getByRole("button", { name: /Щит/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("19")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Мой ход начался" }));

    // Пока строка эффекта висит, шапка показывает КД 19 — число, которое игрок называет мастеру.
    expect(screen.queryByText(/Щит · КД 19/)).toBeNull();
    expect(within(numbers).getByText("14")).toBeDefined();
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
      within(screen.getByLabelText(/^Заклинания/)).getByRole("button", { name: /Опознание/ }),
    );
    await user.click(screen.getByRole("button", { name: "Схема ритуала" }));

    expect(screen.getByRole("dialog", { name: /Схема ритуала «Опознание»/ })).toBeDefined();
  });

  it("у неритуального заклинания кнопки схемы нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<CombatScreen />);

    await user.click(
      within(screen.getByLabelText(/^Заклинания/)).getByRole("button", { name: /Луч холода/ }),
    );

    expect(screen.queryByRole("button", { name: "Схема ритуала" })).toBeNull();
  });
});
