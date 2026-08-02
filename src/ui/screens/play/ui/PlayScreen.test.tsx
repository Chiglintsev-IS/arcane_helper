// @vitest-environment jsdom

/**
 * Экран боя проверяется на настоящем состоянии и настоящих операциях: хранилище в памяти,
 * контент Торна, движок правил. Моков нет — иначе тест подтверждает поведение мока.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { exportSnapshot } from "@/core/application/dataExchange";
import type { CharacterState } from "@/core/domain/character/state";
import { renderWithStores, spell } from "@/ui/app/testing/stores";
import { PlayScreen } from "./PlayScreen";

/**
 * Торн в режиме «Книга»: виден весь состав, включая долгое накладывание и ритуалы.
 *
 * Нужен там, где проверяется сама карточка, а не отбор по режиму: в «Бою» «Починки» и «Опознания»
 * нет по составу режима, и тест о формате подписи спотыкался бы о режим.
 */
function inBookMode(): CharacterState {
  return { ...createThorne(), screenMode: "book" };
}

/** Бой отмечен начатым: только тогда ведётся учёт хода. */
const IN_FIGHT = { inFight: true } as const;

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
  it("показывает производные числа и ячейки, но не имя с классом (FR-001)", async () => {
    await renderWithStores(<PlayScreen />);

    // Имени, класса и уровня в шапке нет: их место — «Лист».
    expect(screen.queryByRole("heading", { name: "Торн" })).toBeNull();
    expect(screen.queryByText(/Волшебник, 7 уровень/)).toBeNull();

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
    await renderWithStores(<PlayScreen />);

    expect(screen.queryByLabelText("Действие доступно")).toBeNull();
    expect(screen.queryByLabelText("Реакция доступна")).toBeNull();
  });

  it("показывает все три вида экономии, когда все три есть в списке (FR-001)", async () => {
    // Бонусное действие появилось вместе с «Туманным шагом»: значку стало что отражать, и
    // переключатель вернулся сам, без правки интерфейса.
    await renderWithStores(<PlayScreen />, createThorne(), IN_FIGHT);

    expect(screen.getByLabelText("Действие доступно")).toBeDefined();
    expect(screen.getByLabelText("Реакция доступна")).toBeDefined();
    expect(screen.getByLabelText("Бонусное действие доступно")).toBeDefined();
  });

  it("вида действия, которого в списке нет, в шапке тоже нет (FR-001)", async () => {
    // Снимаем «Туманный шаг» с подготовки — бонусных заклинаний в бою не остаётся.
    const character = createThorne();
    character.preparedSpellIds = character.preparedSpellIds.filter((id) => id !== "misty-step");
    await renderWithStores(<PlayScreen />, character);

    expect(screen.queryByLabelText("Бонусное действие доступно")).toBeNull();
  });

  it("показывает активную концентрацию карточкой с механикой (FR-084)", async () => {
    // Состав карточки проверяется в Concentration.test.tsx; здесь — что шапка её вообще показывает.
    await renderWithStores(<PlayScreen />, concentrating());
    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
  });

  it("КД меняется после применения «Доспехов мага»: 14 → 17 (FR-093)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("14")).toBeDefined();

    // Применение проверяется в начатом бою: до «Начать бой» причина добавила бы лишний
    // шаг мастера, а этот тест — про КД, а не про сам факт начала боя.
    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(within(numbers).getByText("17")).toBeDefined();
    // Вклад подписан на строке эффекта: игрок видит, откуда взялось новое число.
    expect(screen.getByText(/Доспехи мага · КД 17/)).toBeDefined();
  });

  it("отмена применения возвращает КД к 14", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(within(screen.getByLabelText("Ресурсы")).getByText("17")).toBeDefined();

    // Отменяют только в журнале. Шапки там нет, но блок действующего есть: отмена уносит эффект,
    // и это видно на том же экране, где нажали кнопку.
    await user.click(screen.getByRole("radio", { name: /^Журнал/ }));
    await user.click(screen.getByRole("button", { name: /^Отменить/ }));
    expect(screen.queryByText(/Доспехи мага · КД/)).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Игра/ }));
    expect(within(screen.getByLabelText("Ресурсы")).getByText("14")).toBeDefined();
  });

  it("израсходованная реакция видна ярлыком, а её состояние — доступным именем (FR-144)", async () => {
    const character = createThorne();
    character.reactionAvailable = false;
    const { stores } = await renderWithStores(<PlayScreen />, character, IN_FIGHT);

    // Реакция считается потраченной по журналу: отмечаем её расход применением «Щита».
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Щит/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(stores.session.getState().session?.character.reactionAvailable).toBe(false);
    const spent = screen.getByLabelText("Реакция израсходована");
    expect(within(spent).getByText("Реакция")).toBeDefined();
  });
});

describe("режимы экрана (FR-200, FR-201, FR-204)", () => {
  it("начинает с «Игры» и показывает всё творимое сейчас (FR-209)", async () => {
    await renderWithStores(<PlayScreen />);

    expect(screen.getByRole("radio", { name: /^Игра/ })).toHaveProperty("ariaChecked", "true");
    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Луч холода")).toBeDefined();
    // Пока бой не идёт, торопиться некуда: долгое накладывание и ритуал из книги на месте.
    expect(list.getByText("Починка")).toBeDefined();
    expect(list.getByText("Поиск фамильяра")).toBeDefined();
  });

  it("начало боя убирает то, чем в ход не сходить (FR-201)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));

    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Луч холода")).toBeDefined();
    expect(list.queryByText("Починка")).toBeNull();
    expect(list.queryByText("Поиск фамильяра")).toBeNull();
    // Неподготовленный ритуал уходит совсем: ячейкой его не сотворить.
    expect(list.queryByText("Обнаружение магии")).toBeNull();
  });

  it("книга не отбирает ничего", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));

    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Щит")).toBeDefined();
    expect(list.getByText("Починка")).toBeDefined();
  });

  it("«Лист» показывает персонажа целиком и ничего из боя (FR-230)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("radio", { name: /^Лист/ }));

    // Лист открывается итогом: числа, которые спрашивают за столом.
    expect(screen.getByRole("heading", { name: "Числа боя" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Здоровье" })).toBeDefined();
    // Ни шапки, ни списка, ни отметок схватки: лист отвечает, кто он, а не что он делает сейчас.
    expect(screen.queryByLabelText("Ресурсы")).toBeNull();
    expect(screen.queryByLabelText(/^Заклинания/)).toBeNull();
    expect(stores.session.getState().session?.character.screenMode).toBe("sheet");
  });

  it("«Лист»: правка характеристики доходит до состояния и в журнал (FR-231)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("radio", { name: /^Лист/ }));
    await user.click(screen.getByRole("tab", { name: "Персонаж" }));
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
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("radio", { name: /^Лист/ }));
    await user.click(screen.getByRole("button", { name: "Править: Числа боя" }));
    await user.click(screen.getByRole("button", { name: /^КС спасброска/ }));

    const field = screen.getByLabelText("Значение");
    await user.clear(field);
    await user.type(field, "18");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(stores.session.getState().session?.character.overrides.spellSaveDc).toBe(18);
    expect(screen.getByText("(введено руками)")).toBeDefined();
  });

  it("«Лист»: уровень пересчитывает ресурсы одной записью (FR-227)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("radio", { name: /^Лист/ }));
    await user.click(screen.getByRole("tab", { name: "Персонаж" }));
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

  it("«Лист»: надетая вещь двигает КД, снятая — возвращает (FR-234)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("radio", { name: /^Лист/ }));
    await user.click(screen.getByRole("tab", { name: "Инвентарь" }));
    await user.click(screen.getByRole("button", { name: "Править: Вещи" }));

    await user.type(screen.getByLabelText("Новая вещь"), "Кольцо защиты");
    const armorField = screen.getByLabelText("К защите");
    await user.clear(armorField);
    await user.type(armorField, "1");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    // Вещь легла в сумку: КД пока прежний — лежащее не действует.
    const carried = stores.session.getState().session?.character.equipment.items ?? [];
    expect(carried.find((item) => item.id === "кольцо-защиты")?.worn).toBe(false);
    await user.click(screen.getByRole("switch", { name: "Надето: Кольцо защиты" }));

    const worn = stores.session.getState().session?.character;
    expect(worn?.equipment.items.find((item) => item.id === "кольцо-защиты")?.worn).toBe(true);
    // Персонаж при этом не тронут: вещь не меняет того, кто он.
    expect(worn?.abilities).toEqual(createThorne().abilities);
  });

  it("«Лист»: отмена шторки состояния не трогает", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("radio", { name: /^Лист/ }));
    await user.click(screen.getByRole("button", { name: "Править: Отметки мастера" }));
    await user.click(screen.getByRole("radio", { name: "Ступень 3" }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(stores.session.getState().session?.character.exhaustion).toBe(0);
    expect(stores.session.getState().session?.journal).toHaveLength(0);
  });

  it("режим попадает в состояние, а журнал не засоряет (FR-204)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));

    // Сохранение — да, запись в журнал — нет: режим меняет вид, отменять в нём нечего.
    expect(stores.session.getState().session?.character.screenMode).toBe("book");
    expect(stores.session.getState().session?.journal).toHaveLength(0);
  });

  it("«Ритуал» спрашивает про способ, а не про признак записи (FR-002)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    // Пока бой не идёт, ритуалом сотворить можно — переключатель на месте и в «Игре», и в «Книге».
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.getByRole("button", { name: "Ритуал" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Действие" })).toBeDefined();

    // С началом боя способа нет нигде: ритуал занимает на десять минут больше обычного, и вкладка
    // этого не меняет.
    await user.click(screen.getByRole("radio", { name: /^Игра/ }));
    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.queryByRole("button", { name: "Ритуал" })).toBeNull();
  });

  it("в «Книге» шапки ресурсов нет вовсе (FR-217)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    const inCombat = within(screen.getByLabelText("Ресурсы"));
    expect(inCombat.getByLabelText("Ячейки заклинаний")).toBeDefined();
    expect(inCombat.getByText("КС")).toBeDefined();

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));

    // Книга отвечает, что персонаж знает, а не чем он за это заплатит: ни ячеек, ни чисел боя.
    expect(screen.queryByLabelText("Ресурсы")).toBeNull();
    expect(screen.queryByLabelText("Ячейки заклинаний")).toBeNull();
    expect(screen.queryByText("КС")).toBeNull();
  });

  it("шапка сокращает КС, потому что рядом стоит КД", async () => {
    await renderWithStores(<PlayScreen />);

    const header = within(screen.getByLabelText("Ресурсы"));
    expect(header.getByText("КС")).toBeDefined();
    expect(header.getByText("КД")).toBeDefined();
    // Третьего имени одному числу не заводится: «КС закл.» было им.
    expect(header.queryByText("КС закл.")).toBeNull();
  });

  it("кости хитов шапка называет и в бою, и вне его (FR-134)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    expect(screen.getByLabelText("Кости хитов 7d6")).toBeDefined();

    // Постоянная часть ряда с началом боя не меняется: значку незачем прыгать.
    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    expect(screen.getByLabelText("Кости хитов 7d6")).toBeDefined();
  });

  it("инициатива приходит с боем и встаёт за постоянной частью (FR-232)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    expect(screen.getByLabelText("Пассивное восприятие 14")).toBeDefined();
    expect(screen.queryByText(/Инициатива/)).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));

    // Постоянная часть на месте, инициатива и раунд встали за ней.
    const badges = within(screen.getByLabelText("Прочие ресурсы"))
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    expect(badges.slice(0, 6)).toEqual([
      "✚Кости 7d6",
      "◉Восприятие 14",
      "❖Руны 3/3",
      "✚Очки 0",
      "◔Инициатива +1",
      "◷Раунд 1",
    ]);
  });

  it("истощение видно значком со ступенью (FR-232)", async () => {
    const marked = createThorne();
    marked.exhaustion = 3;
    await renderWithStores(<PlayScreen />, marked);

    expect(screen.getByLabelText("Истощение: ступень 3")).toBeDefined();
  });

  it("вдохновение видно, когда оно есть (FR-232)", async () => {
    const marked = createThorne();
    marked.inspiration = true;
    await renderWithStores(<PlayScreen />, marked);

    expect(screen.getByLabelText("Вдохновение")).toBeDefined();
  });

  it("отсутствующего шапка не показывает (FR-232)", async () => {
    await renderWithStores(<PlayScreen />);

    expect(screen.queryByLabelText(/Истощение/)).toBeNull();
    expect(screen.queryByLabelText("Вдохновение")).toBeNull();
  });

  it("полоса фильтров стоит и в бою, и вне его: список есть всегда (FR-002)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    expect(screen.getByLabelText("Фильтры")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    expect(screen.getByLabelText("Фильтры")).toBeDefined();
  });
});

describe("фильтры (FR-002, FR-003, AC-07)", () => {
  it("фильтр по времени накладывания оставляет только подходящие заклинания", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Реакция" }));

    // Три подготовленные реакции: «Щит», «Поглощение стихий», «Контрзаклинание». «Падение
    // пёрышком» в стартовый набор не входит.
    const list = screen.getByLabelText(/^Заклинания/);
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByText("Щит")).toBeDefined();
    expect(within(list).getByText("Контрзаклинание")).toBeDefined();
  });

  it("значения одной категории соединяются «или»", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Реакция" }));
    await user.click(screen.getByRole("button", { name: "Действие" }));

    const list = screen.getByLabelText(/^Заклинания/);
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(2);
    expect(within(list).getByText("Щит")).toBeDefined();
    expect(within(list).getByText("Луч холода")).toBeDefined();
  });

  it("объясняет пустой результат, а не показывает пустой экран", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    // Реакций, которые при этом боевые, у Торна нет: обе его реакции — защитные.
    await user.click(screen.getByRole("button", { name: "Реакция" }));
    await user.click(screen.getByRole("button", { name: "Боевое" }));

    expect(screen.getByText(/не подходит ни одно заклинание/)).toBeDefined();
    // Кнопки сброса нет: выбранное снимают там же, где поставили, — полоса никуда не уехала.
    expect(screen.queryByRole("button", { name: /Сбросить/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Боевое" }));
    expect(screen.getByLabelText(/^Заклинания/)).toBeDefined();
  });

  it("в «Книге» переключателя «Доступно» нет: он повторял бы «Подготовлено» (FR-212)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    const sheet = screen.queryByRole("dialog", { name: "Бой закончен?" });
    if (sheet !== null) await user.click(within(sheet).getByRole("button", { name: "Нет, продолжается" }));

    expect(screen.getByRole("button", { name: "Подготовлено" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Доступно" })).toBeNull();
  });
});

describe("операции привала (FR-202, FR-215)", () => {
  /**
   * Торн на привале, потративший ячейку первого уровня: восстанавливать есть что.
   *
   * Привал открывается кнопкой: вместе со списком и фильтрами он на экран не помещается.
   */
  async function atCamp(character: CharacterState = createThorne()) {
    const spent = {
      ...character,
      spellSlots: { ...character.spellSlots, 1: { maximum: 4, remaining: 2 } },
    };
    const rendered = await renderWithStores(<PlayScreen />, spent);
    await userEvent.click(screen.getByRole("button", { name: "Привал" }));
    return rendered;
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

    // Короткий отдых — предусловие правила: до него восстановление недоступно.
    await user.click(screen.getByRole("button", { name: /Короткий отдых/ }));
    await user.click(screen.getByRole("button", { name: "Привал" }));
    await user.click(screen.getByRole("button", { name: /Магическое восстановление/ }));
    await user.click(screen.getByRole("button", { name: "Вернуть ячейку 1 уровня" }));
    await user.click(screen.getByRole("button", { name: "Вернуть ячейки" }));

    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(3);
    expect(stores.session.getState().session?.character.arcaneRecoveryAvailable).toBe(false);
  });

  it("израсходованное восстановление гаснет, но остаётся с причиной (FR-131)", async () => {
    // Раньше кнопка исчезала. Пропавшая кнопка не отвечает на вопрос «почему нельзя», а за столом
    // он возникает раньше, чем игрок вспомнит правило, — требование это изменило.
    await atCamp({ ...createThorne(), arcaneRecoveryAvailable: false });
    const button = screen.getByRole("button", {
      name: "Магическое восстановление — Уже использовано до следующего долгого отдыха",
    });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("без короткого отдыха восстановление недоступно (FR-131)", async () => {
    const user = userEvent.setup();
    const spent = createThorne();
    spent.spellSlots[1] = { maximum: 4, remaining: 3 };
    await atCamp(spent);

    // Причина названа словами на самой кнопке, и лечится она соседней — в том же ряду.
    const blocked = screen.getByRole("button", {
      name: "Магическое восстановление — Берётся после короткого отдыха",
    });
    expect(blocked.hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: /Короткий отдых/ }));
    await user.click(screen.getByRole("button", { name: "Привал" }));
    expect(
      screen.getByRole("button", { name: "Магическое восстановление" }).hasAttribute("disabled"),
    ).toBe(false);
  });

  it("без снижения максимума «Прошёл час» не предлагается (FR-002)", async () => {
    await atCamp();
    expect(screen.queryByRole("button", { name: /Прошёл час/ })).toBeNull();
  });

  it("«Прошёл час» возвращает часть снижённого максимума (FR-173)", async () => {
    const user = userEvent.setup();
    const reduced = createThorne();
    reduced.hitPoints = { current: 51, maximumBase: 60, bloodReduction: 9, masterReduction: 0 };
    await renderWithStores(<PlayScreen />, reduced);

    await user.click(screen.getByRole("button", { name: "Привал" }));
    await user.click(screen.getByRole("button", { name: /Прошёл час/ }));
    // На 7 уровне возвращается 3 за час: максимум 51 → 54, текущие не растут.
    expect(screen.getByLabelText("Ресурсы").textContent).toContain("51/54");
  });

  it("вне боя нет ни «Нового хода», ни счётчика раундов (FR-221)", async () => {
    await renderWithStores(<PlayScreen />);

    // «Начать бой» на месте: с неё бой и начинается. Хода вне боя нет, и раунда тоже.
    expect(screen.getByRole("button", { name: "Начать бой" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Окончить бой|Новый ход/ })).toBeNull();
    expect(screen.getByLabelText("Ресурсы").textContent).not.toContain("Раунд");
  });

  it("бой убирает вход в привал (FR-215)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    expect(screen.getByRole("button", { name: "Привал" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    expect(screen.queryByRole("button", { name: "Привал" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Окончить бой" }));
    await user.click(screen.getByRole("button", { name: "Да, бой закончен" }));
    expect(screen.getByRole("button", { name: "Привал" })).toBeDefined();
  });

  it("в книге привала нет: там читают, а не отдыхают", async () => {
    await renderWithStores(<PlayScreen />, inBookMode());
    expect(screen.queryByRole("button", { name: "Привал" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Долгий отдых/ })).toBeNull();
  });
});

describe("повторяемое действие эффекта (FR-092)", () => {
  it("напоминает о ежеходной работе, пока эффект держится", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await user.click(screen.getByRole("button", { name: /^Отражения/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const effects = within(screen.getByLabelText("Активные эффекты"));
    expect(effects.getByText(/Считать отражения/)).toBeDefined();
  });

  it("у эффекта без ежеходной работы напоминания нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await user.click(screen.getByRole("button", { name: /^Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const effects = within(screen.getByLabelText("Активные эффекты"));
    expect(effects.getByText(/Доспехи мага/)).toBeDefined();
    expect(effects.queryByText(/↻/)).toBeNull();
  });
});

describe("ручная правка ресурсов (FR-071, FR-142, FR-155)", () => {
  it("плитка ячейки открывает правку и возвращает списанное", async () => {
    const user = userEvent.setup();
    const character = createThorne();
    character.spellSlots = { ...character.spellSlots, 1: { maximum: 4, remaining: 2 } };
    const { stores } = await renderWithStores(<PlayScreen />, character);

    await user.click(screen.getByRole("button", { name: /Ячейки 1 уровня: 2 из 4/ }));
    await user.click(screen.getByRole("button", { name: "Вернуть: Ячейка 1 ур." }));

    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(3);
  });

  it("руны правятся вручную и правка обратима (FR-111)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: /Ячейки 1 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Потратить: Руны" }));
    expect(stores.session.getState().session?.character.runes.remaining).toBe(2);

    await user.click(screen.getByRole("button", { name: "Закрыть" }));
    // Кнопка отмены живёт только в журнале — путь к ней длиннее на одно нажатие.
    await user.click(screen.getByRole("radio", { name: /^Журнал/ }));
    await user.click(screen.getByRole("button", { name: /^Отменить/ }));
    expect(stores.session.getState().session?.character.runes.remaining).toBe(3);
  });

  it("за границы пула правка не пускает", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: /Ячейки 1 уровня/ }));
    expect(screen.getByRole("button", { name: "Вернуть: Руны" })).toHaveProperty("disabled", true);
  });
});

describe("выгрузка и загрузка (FR-120, FR-121, FR-122)", () => {
  /** Выгрузка приложения, снятая с текущего состояния: её же и загружаем обратно. */
  async function openData(character: CharacterState = createThorne()) {
    const user = userEvent.setup();
    const rendered = await renderWithStores(<PlayScreen />, {
      ...character,
      screenMode: "journal",
    });
    await user.click(screen.getByRole("button", { name: "Данные" }));
    return { user, ...rendered };
  }

  it("«Данные» живут в «Журнале» (FR-222)", async () => {
    await renderWithStores(<PlayScreen />);
    expect(screen.queryByRole("button", { name: "Данные" })).toBeNull();

    await renderWithStores(<PlayScreen />, inBookMode());
    expect(screen.queryByRole("button", { name: "Данные" })).toBeNull();

    await renderWithStores(<PlayScreen />, { ...createThorne(), screenMode: "journal" });
    expect(screen.getByRole("button", { name: "Данные" })).toBeDefined();
  });

  it("битый файл называет причину и состояние не трогает (FR-121, FR-122)", async () => {
    const { user, stores } = await openData();
    const before = stores.session.getState().session?.character.preparedSpellIds;

    await user.type(screen.getByLabelText("Данные для загрузки"), "не файл");
    await user.click(screen.getByRole("button", { name: "Загрузить" }));

    expect(screen.getByRole("alert").textContent).toContain("не JSON");
    expect(stores.session.getState().session?.character.preparedSpellIds).toEqual(before);
  });

  it("своя выгрузка загружается обратно и восстанавливает ресурсы (FR-120)", async () => {
    const saved = exportSnapshot(createThorne(), loadThorneSpells(), "2026-07-31T18:00:00.000Z");

    const spent: CharacterState = createThorne();
    spent.spellSlots = { ...spent.spellSlots, 1: { maximum: 4, remaining: 0 } };
    const { user, stores } = await openData(spent);

    // `type` посимвольно на длинном JSON слишком медленный: вставляем как из буфера.
    await user.click(screen.getByLabelText("Данные для загрузки"));
    await user.paste(JSON.stringify(saved));
    await user.click(screen.getByRole("button", { name: "Загрузить" }));

    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(4);
    // Журнал начинается заново: записи прежнего персонажа к новому состоянию не относятся.
    expect(stores.session.getState().session?.journal).toEqual([]);
  });
});

describe("реакции (FR-060, FR-061, FR-062)", () => {
  it("вход одним нажатием, вопрос о событии первым", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Реакции" }));

    const sheet = within(screen.getByRole("dialog", { name: "Реакции" }));
    expect(sheet.getByText("Что произошло?")).toBeDefined();
    // Список заклинаний до выбора события не показывается: игрок думает о событии, а не о названии.
    expect(screen.queryByLabelText("Подходящие реакции")).toBeNull();
  });

  it("событие находит своё заклинание и называет изменённое число (FR-062)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Реакции" }));
    await user.click(screen.getByRole("radio", { name: "По мне попали" }));

    const matching = within(screen.getByLabelText("Подходящие реакции"));
    expect(matching.getByText("Щит")).toBeDefined();
    // Готовое число, а не формула: 14 базовых плюс 5.
    expect(matching.getByText("КД 19 вместо 14")).toBeDefined();
  });

  it("на событие без ответа переключателя нет (FR-002)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Реакции" }));
    // «Искусная острота» в книгу не вошла — отвечать на успешный бросок врага нечем.
    expect(screen.queryByRole("radio", { name: "Враг преуспел в броске" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Я провалил спасбросок" })).toBeDefined();
  });

  it("выбор реакции открывает мастер применения (FR-022)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Реакции" }));
    await user.click(screen.getByRole("radio", { name: "Враг творит заклинание" }));
    await user.click(
      within(screen.getByLabelText("Подходящие реакции")).getByRole("button", {
        name: /Контрзаклинание/,
      }),
    );

    expect(screen.getByRole("dialog", { name: /Применение/ })).toBeDefined();
    // До подтверждения состояние не тронуто.
    expect(stores.session.getState().session?.journal).toHaveLength(0);
  });

  it("израсходованная реакция не прячет варианты, а объясняет причину (FR-031)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    // Тратим реакцию «Щитом», затем открываем экран реакций снова.
    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await user.click(screen.getByRole("button", { name: /^Щит/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    await user.click(screen.getByRole("button", { name: "Реакции" }));
    await user.click(screen.getByRole("radio", { name: "По мне попали" }));

    const suitable = within(screen.getByLabelText("Подходящие реакции"));
    expect(suitable.getByText("Щит")).toBeDefined();

    // Причина стоит там, где выбирают: вариант открывается, и мастер называет её словами.
    await user.click(suitable.getByText("Щит"));
    expect(screen.getByText("Реакция уже израсходована")).toBeDefined();
    expect(screen.getByRole("button", { name: "Применить всё равно" })).toBeDefined();
  });

  it("провал спасброска отвечает руной, а не заклинанием (FR-153)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Реакции" }));
    await user.click(screen.getByRole("radio", { name: "Я провалил спасбросок" }));
    await user.click(screen.getByRole("button", { name: /Потратить руну/ }));

    expect(stores.session.getState().session?.character.runes.remaining).toBe(2);
    expect(stores.session.getState().session?.character.reactionAvailable).toBe(false);
  });
});

describe("подготовка в «Книге» (FR-214, FR-101)", () => {
  it("отмечает и снимает подготовку прямо в списке", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />, inBookMode());

    // Набор Торна ровно на пределе, поэтому сначала освобождаем место.
    await user.click(screen.getByRole("button", { name: "Снять подготовку: Отражения" }));
    await user.click(screen.getByRole("button", { name: "Подготовить: Обнаружение магии" }));
    expect(stores.session.getState().session?.character.preparedSpellIds).toContain("detect-magic");

    await user.click(screen.getByRole("button", { name: "Снять подготовку: Обнаружение магии" }));
    expect(stores.session.getState().session?.character.preparedSpellIds).not.toContain(
      "detect-magic",
    );
  });

  it("подготовленное появляется в боевом списке (FR-209)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />, inBookMode());

    await user.click(screen.getByRole("button", { name: "Снять подготовку: Отражения" }));
    await user.click(screen.getByRole("button", { name: "Подготовить: Обнаружение магии" }));
    await user.click(screen.getByRole("radio", { name: /^Игра/ }));

    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Обнаружение магии")).toBeDefined();
    expect(list.queryByText("Отражения")).toBeNull();
  });

  it("считает подготовленное и не считает заговоры (FR-102)", async () => {
    await renderWithStores(<PlayScreen />, inBookMode());

    // Стартовый набор Торна занимает лимит целиком; четыре заговора в него не входят.
    expect(screen.getByLabelText("Подготовлено 11 из 11")).toBeDefined();
    expect(screen.queryByRole("button", { name: /Подготовить: Луч холода/ })).toBeNull();
  });

  it("двенадцатое заклинание упирается в лимит и объясняет причину (FR-101)", async () => {
    const user = userEvent.setup();
    const full = inBookMode();
    // В книге Торна восемь записей, а лимит 11 — до края не дотянуться. Понижаем Интеллект до 8:
    // лимит становится 6 (модификатор −1 плюс уровень 7), и шесть подготовленных его исчерпывают.
    full.abilities = { ...full.abilities, intelligence: 8 };
    full.preparedSpellIds = [...full.spellbookSpellIds].slice(0, 6);
    await renderWithStores(<PlayScreen />, full);

    expect(screen.getByLabelText("Подготовлено 6 из 6")).toBeDefined();
    // Седьмое: подготовки нет ровно у двух записей книги, берём первую попавшуюся.
    await user.click(screen.getAllByRole("button", { name: /^Подготовить: / })[0]!);

    expect(screen.getByRole("alert").textContent).toContain("Подготовлено 6 из 6");
  });

  it("в бою подготовку не меняют: состав уже определён", async () => {
    await renderWithStores(<PlayScreen />);
    expect(screen.queryByRole("button", { name: /^Подготовить: / })).toBeNull();
    expect(screen.queryByText(/Подготовлено \d+ из/)).toBeNull();
  });
});

describe("конец боя (FR-216, FR-221)", () => {
  function wounded(): CharacterState {
    const character = createThorne();
    character.hitPoints = { current: 12, maximumBase: 60, bloodReduction: 0, masterReduction: 0 };
    return character;
  }

  it("кнопка конца боя восстанавливает до половины максимума", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />, wounded());

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await user.click(screen.getByRole("button", { name: "Окончить бой" }));
    await user.click(screen.getByRole("button", { name: "Да, бой закончен" }));
    expect(stores.session.getState().session?.character.hitPoints.current).toBe(30);
  });

  it("«нет, продолжается» ничего не меняет", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />, wounded());

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await user.click(screen.getByRole("button", { name: "Окончить бой" }));
    await user.click(screen.getByRole("button", { name: "Нет, продолжается" }));

    // 15, а не 12: начало боя — это первый ход, и регенерация тролля на нём сработала.
    expect(stores.session.getState().session?.character.hitPoints.current).toBe(15);
    expect(stores.session.getState().session?.journal.at(-1)?.kind).toBe("combat_started");
  });

  it("при полном здоровье бой всё равно можно закончить, но лечения не обещает", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await user.click(screen.getByRole("button", { name: "Окончить бой" }));

    // Конец боя — факт, а не лечение: он сбрасывает счёт раундов, и здоровому это нужно так же.
    const sheet = screen.getByRole("dialog", { name: "Бой закончен?" });
    expect(within(sheet).getByText(/Счёт раундов начнётся заново/)).toBeDefined();
    expect(within(sheet).queryByText(/здоровье поднимется/)).toBeNull();

    await user.click(within(sheet).getByRole("button", { name: "Да, бой закончен" }));
    expect(stores.session.getState().session?.journal.at(-1)?.kind).toBe("combat_ended");
  });

  it("отметки схватки (FR-221)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    // Пока бой не начат, заканчивать нечего, и ходов не бывает: «Нового хода» на экране нет.
    expect(screen.queryByRole("button", { name: "Окончить бой" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Новый ход" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Начать бой" }));

    expect(screen.queryByRole("button", { name: "Начать бой" })).toBeNull();
    expect(screen.getByRole("button", { name: "Окончить бой" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Новый ход" })).toBeDefined();
  });

  it("следующий бой начинается с первого раунда", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await user.click(screen.getByRole("button", { name: "Новый ход" }));
    expect(screen.getByText("Раунд 2")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Окончить бой" }));
    await user.click(screen.getByRole("button", { name: "Да, бой закончен" }));

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    expect(screen.getByText("Раунд 1")).toBeDefined();
  });

  it("переход между привалом и книгой вопроса не задаёт: бой уже позади", async () => {
    const user = userEvent.setup();
    const character = wounded();
    await renderWithStores(<PlayScreen />, character);

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.queryByRole("dialog", { name: "Бой закончен?" })).toBeNull();
  });
});

describe("магия крови в списке действий (FR-207)", () => {
  it("стоит в бою среди заклинаний и подчиняется тем же фильтрам", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

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
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Боевое" }));
    expect(screen.queryByRole("button", { name: /Магия крови/ })).toBeNull();
  });

  // Случай «строка крови осталась, а заклинаний не осталось» на нынешнем контенте недостижим:
  // «Сообщение» — заговор, и его признаки (действие, роль «другое», без концентрации) совпадают с
  // признаками обмена в точности. Экран этот случай всё равно различает: пустое сообщение
  // появляется, только когда не подошло вообще ничего.
});

describe("«Магия крови» в «Книге» (FR-207)", () => {
  it("стоит в списке книги сразу за заговорами: очки покупают вне боя", async () => {
    await renderWithStores(<PlayScreen />, inBookMode());

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
    await renderWithStores(<PlayScreen />, inBookMode());

    await user.click(screen.getByRole("button", { name: "Без ячейки" }));
    expect(screen.getByRole("button", { name: /Магия крови/ })).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Без ячейки" }));
    await user.click(screen.getByRole("button", { name: "1 ур." }));
    expect(screen.queryByText("Магия крови")).toBeNull();
  });

  it("«Подготовлено» её не прячет: подготовка к обмену не относится", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />, inBookMode());

    await user.click(screen.getByRole("button", { name: "Подготовлено" }));

    expect(screen.getByRole("button", { name: /Магия крови/ })).toBeDefined();
  });
});

describe("краткая карточка (FR-010)", () => {
  it("показывает время, цену, дальность и пересказ эффекта", async () => {
    await renderWithStores(<PlayScreen />);
    const row = screen.getByRole("button", { name: /Луч холода/ });

    // Цену говорит строка стоимости, а не значок.
    expect(within(row).getByText("Без ячейки")).toBeDefined();
    expect(within(row).getByText("Действие")).toBeDefined();
    expect(within(row).getByText("60 футов")).toBeDefined();
    expect(within(row).getByText(spell("ray-of-frost").shortRulesRu)).toBeDefined();
  });

  it("угол карточки занимает роль во всех режимах (FR-211)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    const inFight = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(inFight.getByText("Боевое")).toBeDefined();

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));

    // Карточка одна на все режимы: разный вид читался как две разные программы.
    const inBook = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(inBook.getByText("Боевое")).toBeDefined();
  });

  it("разрешение называет число, а не вид броска (FR-211)", async () => {
    await renderWithStores(<PlayScreen />);

    // Название проверки и число вместе: «Атака» без числа — половина ответа, «d20+8» без названия
    // не связывается с тем, что скажет мастер.
    const row = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(row.getByText("Атака d20+8")).toBeDefined();
  });

  it("накладывание дольше хода называет точное время, а не категорию (FR-033)", async () => {
    await renderWithStores(<PlayScreen />, inBookMode());
    const row = screen.getByRole("button", { name: /Починка/ });

    expect(within(row).getByText("Накладывать 1 минуту")).toBeDefined();
    expect(within(row).queryByText("Минуты")).toBeNull();
  });

  it("называет минимальную стоимость применения", async () => {
    await renderWithStores(<PlayScreen />);

    // «Поглощение стихий» растёт с уровнем ячейки — «от» обещает выгоду, и она есть.
    expect(
      within(screen.getByRole("button", { name: /Поглощение стихий/ })).getByText(
        "Ячейка от 1 ур.",
      ),
    ).toBeDefined();
  });

  it("не обещает выгоды от ячейки повыше там, где её нет (FR-010)", async () => {
    // «Доспехи мага» с ячейки 3 уровня работают ровно как с первой: «от» звало бы тратить зря.
    await renderWithStores(<PlayScreen />);

    const row = within(screen.getByRole("button", { name: /Доспехи мага/ }));
    expect(row.getByText("Ячейка 1 ур.")).toBeDefined();
    expect(row.queryByText("Ячейка от 1 ур.")).toBeNull();
  });

  it("у заговора цена названа во всех режимах: строка не молчит о стоимости (FR-010)", async () => {
    await renderWithStores(<PlayScreen />, inBookMode());

    // Цена названа один раз: значок «Заговор» повторял бы строку «Без ячейки» тем же словом.
    const row = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(row.getByText(/Без ячейки/)).toBeDefined();
    expect(row.queryByText("Заговор")).toBeNull();
    expect(row.queryByText(/Ячейка/)).toBeNull();
  });

  it("недоступное заклинание объясняет причину словами", async () => {
    // Ячейки 1 уровня не хватило бы: заклинание можно поднять до 4 уровня или оплатить кровью,
    // поэтому недоступным оно становится только когда не осталось ни одного способа.
    const character = createThorne();
    character.spellSlots = {
      1: { maximum: 4, remaining: 0 },
      2: { maximum: 3, remaining: 0 },
      3: { maximum: 3, remaining: 0 },
      4: { maximum: 1, remaining: 0 },
    };
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />, character);
    // Бой начат: тест проверяет причину нехватки ячеек, а не причину — иначе она заслонила
    // бы собой то, ради чего написан этот тест.
    await user.click(screen.getByRole("button", { name: "Начать бой" }));

    const row = screen.getByRole("button", { name: /Доспехи мага/ });
    expect(within(row).getByText(/Нет свободной ячейки 1 уровня/)).toBeDefined();
  });

  it("неподготовленный ритуал не объясняется подготовкой (FR-103)", async () => {
    // Ритуалу подготовка не нужна, и мастер применения предложит именно ритуал. Строка списка
    // обязана назвать ту же причину, иначе она отговаривает от способа, который работает.
    const user = userEvent.setup();
    // Ритуал в бою не показывается, пока не подготовлен: сверяем причину в книге.
    await renderWithStores(<PlayScreen />, { ...concentrating(), screenMode: "book" });

    await user.click(screen.getByRole("button", { name: "Ритуал" }));

    // Поиск ограничен списком: карточка концентрации в шапке названа тем же заклинанием.
    const row = within(screen.getByLabelText(/^Заклинания/)).getByRole("button", {
      name: /^Обнаружение магии/,
    });
    expect(within(row).queryByText(/Заклинание не подготовлено/)).toBeNull();
    expect(within(row).getByText(/Уже идёт концентрация/)).toBeDefined();
  });
});

describe("учёт хода и отмена (FR-111, FR-143)", () => {
  it("«Новый ход» восстанавливает израсходованное", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />, createThorne(), IN_FIGHT);

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(screen.getByLabelText("Действие израсходовано")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Новый ход" }));
    expect(screen.getByLabelText("Действие доступно")).toBeDefined();
    expect(stores.session.getState().session?.character.turnTracking.actionAvailable).toBe(true);
  });

  it("«Щит» сам исчезает с началом следующего хода, КД возвращается к 14 (FR-094)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />, createThorne(), IN_FIGHT);

    await user.click(screen.getByRole("button", { name: /Щит/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("19")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Новый ход" }));

    // Пока строка эффекта висит, шапка показывает КД 19 — число, которое игрок называет мастеру.
    expect(screen.queryByText(/Щит · КД 19/)).toBeNull();
    expect(within(numbers).getByText("14")).toBeDefined();
  });

  // Прогон о возврате ячейки переехал в блок «режим „Журнал“»: отмена живёт только там.

  it("учёт хода следует из отметки боя, а не из вкладки (FR-143)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    // Кнопки «Учёт хода» нет: она умела выключить счёт и оставить зелёные галочки.
    expect(screen.queryByRole("button", { name: "Учёт хода" })).toBeNull();
    expect(screen.queryByLabelText("Действие доступно")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    expect(screen.getByLabelText("Действие доступно")).toBeDefined();

    // Уход в «Книгу» на учёт не влияет: признак приходит из журнала, а не из вкладки.
    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    await user.click(screen.getByRole("radio", { name: /^Игра/ }));
    expect(screen.getByLabelText("Действие доступно")).toBeDefined();
  });
});

describe("подробная карточка (FR-011, FR-012)", () => {
  it("открывается по строке списка и показывает механику", async () => {
    const user = userEvent.setup();
    // Неподготовленные ритуалы в списке скрыты: показываем их фильтром.
    await renderWithStores(<PlayScreen />, inBookMode());
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

  it("строка «Разрешение» показывает общую подпись, не свою копию (FR-211)", async () => {
    const user = userEvent.setup();
    // Опознание разрешается автоматически, Луч холода — атакой заклинанием: две из трёх схем.
    await renderWithStores(<PlayScreen />, inBookMode());
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /^Опознание/ }));
    const automaticCard = screen.getByRole("dialog", { name: /Опознание/ });
    expect(within(automaticCard).getByText("Разрешение").nextElementSibling?.textContent).toBe(
      "Без броска",
    );
  });

  it("строка «Разрешение» показывает атаку заклинанием общей подписью (FR-211)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: /Луч холода/ }));
    const attackCard = screen.getByRole("dialog", { name: /Луч холода/ });
    expect(within(attackCard).getByText("Разрешение").nextElementSibling?.textContent).toBe(
      "Атака d20+8",
    );
  });

  it("полные правила и отыгрыш закрыты по умолчанию", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: /Луч холода/ }));
    const card = screen.getByRole("dialog", { name: /Луч холода/ });

    const fullRules = within(card).getByText("Полные правила").closest("details");
    const roleplay = within(card).getByText("Отыгрыш").closest("details");
    expect(fullRules?.hasAttribute("open")).toBe(false);
    expect(roleplay?.hasAttribute("open")).toBe(false);
  });

  it("техническая инструкция доступна за два нажатия (M-02)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: /Луч холода/ }));
    await user.click(screen.getByText("Как объявить"));

    expect(screen.getByText(/Атака заклинанием, модификатор \+8/)).toBeDefined();
  });

  it("заметка сохраняется в состоянии и не попадает в журнал", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: /Щит/ }));
    await user.type(screen.getByLabelText("Заметка"), "гасит и стрелу");

    expect(stores.session.getState().session?.character.spellNotes.shield).toBe("гасит и стрелу");
    expect(stores.session.getState().session?.journal).toHaveLength(0);
  });
});

describe("схема ритуала (FR-192)", () => {
  it("карточка ритуала открывает схему на полный экран", async () => {
    const user = userEvent.setup();
    // Ритуалы в списке скрыты по умолчанию: сначала фильтр, потом строка списка.
    await renderWithStores(<PlayScreen />, inBookMode());
    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(
      within(screen.getByLabelText(/^Заклинания/)).getByRole("button", { name: /^Опознание/ }),
    );
    await user.click(screen.getByRole("button", { name: "Схема ритуала" }));

    expect(screen.getByRole("dialog", { name: /Схема ритуала «Опознание»/ })).toBeDefined();
  });

  it("у неритуального заклинания кнопки схемы нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(
      within(screen.getByLabelText(/^Заклинания/)).getByRole("button", { name: /Луч холода/ }),
    );

    expect(screen.queryByRole("button", { name: "Схема ритуала" })).toBeNull();
  });
});

describe("признак «под солнцем» (FR-181, FR-183)", () => {
  it("переключается из правки ресурсов и подавляет особенности", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: /Ячейки 1 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Под прямым солнечным светом" }));

    expect(stores.session.getState().session?.character.suppression.underDirectSunlight).toBe(true);
  });

  it("включённый признак виден значком в шапке, а не только внутри листа", async () => {
    const sunlit = createThorne();
    sunlit.suppression = { firedUpon: false, underDirectSunlight: true };
    await renderWithStores(<PlayScreen />, sunlit);

    const resources = screen.getByLabelText("Прочие ресурсы");
    expect(
      within(resources).getByText("Особенности подавлены: солнечный свет"),
    ).toBeDefined();
  });

  it("выключается тем же переключателем", async () => {
    const user = userEvent.setup();
    const sunlit = createThorne();
    sunlit.suppression = { firedUpon: false, underDirectSunlight: true };
    const { stores } = await renderWithStores(<PlayScreen />, sunlit);

    await user.click(screen.getByRole("button", { name: /Ячейки 1 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Под прямым солнечным светом" }));

    expect(stores.session.getState().session?.character.suppression.underDirectSunlight).toBe(
      false,
    );
  });
});

describe("«Книга» говорит только о книге (FR-217)", () => {
  it("шапки ресурсов нет: ни ячеек, ни рун, ни очков, ни костей хитов", async () => {
    await renderWithStores(<PlayScreen />, inBookMode());

    expect(screen.queryByRole("region", { name: "Ресурсы" })).toBeNull();
    expect(screen.queryByLabelText("Ячейки заклинаний")).toBeNull();
    expect(screen.queryByLabelText("Прочие ресурсы")).toBeNull();
  });

  it("действующего в книге нет: книга — только книга (FR-217)", async () => {
    await renderWithStores(<PlayScreen />, { ...concentrating(), screenMode: "book" });

    // Имя точное: «Концентрация» есть и у переключателя фильтров.
    expect(screen.queryByRole("button", { name: /^Концентрация:/ })).toBeNull();
    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();
  });

  it("нет ни поиска, ни «Реакций», ни отмены", async () => {
    await renderWithStores(<PlayScreen />, inBookMode());

    expect(screen.queryByRole("button", { name: "Поиск" })).toBeNull();
    expect(screen.queryByLabelText("Поиск по названию")).toBeNull();
    expect(screen.queryByRole("button", { name: "Реакции" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();
  });

  it("счётчик подготовки остаётся: он отвечает на вопрос «сколько ещё можно» (FR-214)", async () => {
    await renderWithStores(<PlayScreen />, inBookMode());
    expect(screen.getByLabelText(/^Подготовлено \d+ из \d+/)).toBeDefined();
  });

  it("в «Игре» шапка на месте и в бою, и вне его", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    const outOfFight = within(screen.getByRole("region", { name: "Ресурсы" }));
    expect(outOfFight.getByText(/Руны 3\/3/)).toBeDefined();
    expect(outOfFight.getByText(/Очки 0/)).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Начать бой" }));

    const inFight = within(screen.getByRole("region", { name: "Ресурсы" }));
    expect(inFight.getByText(/Руны 3\/3/)).toBeDefined();
    expect(inFight.getByText(/Очки 0/)).toBeDefined();
  });
});

describe("«Знаки ограждения» вне боя (FR-153)", () => {
  it("кнопка «Реакции» есть в «Игре», но не в «Книге» (FR-217)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    expect(screen.getByRole("button", { name: "Реакции" })).toBeDefined();

    // «Книга» — не место для реакции: её открывают заранее, а не в чужой ход.
    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.queryByRole("button", { name: "Реакции" })).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Игра/ }));
    expect(screen.getByRole("button", { name: "Реакции" })).toBeDefined();
  });

  it("вне боя лист предлагает руну: триггер приходит и до схватки", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Реакции" }));

    const sheet = screen.getByRole("dialog", { name: "Реакции" });
    await user.click(within(sheet).getByRole("radio", { name: /провалил спасбросок/i }));

    await user.click(within(sheet).getByRole("button", { name: /Потратить руну/ }));

    expect(screen.getByLabelText(/Ячейки заклинаний/).textContent).toBeDefined();
    const header = screen.getByRole("region", { name: "Ресурсы" });
    expect(within(header).getByText(/Руны 2\/3/)).toBeDefined();
  });
});

describe("режим «Журнал» (FR-114, FR-220)", () => {
  /** Уйти в журнал: кнопка переключателя названа по режиму и подсказке. */
  async function openJournal(user: ReturnType<typeof userEvent.setup>): Promise<void> {
    await user.click(screen.getByRole("radio", { name: /^Журнал/ }));
  }

  it("в «Игре» и «Книге» кнопки отмены нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />, createThorne(), IN_FIGHT);
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();

    await user.click(screen.getByRole("radio", { name: /^Книга/ }));
    expect(screen.queryByRole("button", { name: /^Отменить/ })).toBeNull();
  });

  it("переключение в «Журнал» показывает записи", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await openJournal(user);

    expect(
      within(screen.getByRole("list", { name: "Журнал событий" })).getByText(/Бой начался/),
    ).toBeDefined();
  });

  it("отмена из журнала возвращает потраченную ячейку", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />, createThorne(), IN_FIGHT);

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(3);

    await openJournal(user);
    await user.click(screen.getByRole("button", { name: /^Отменить/ }));

    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(4);
    // Экран не закрылся: кнопка переехала на запись «Бой начался», и её тоже можно отменить.
    expect(screen.getByRole("button", { name: "Отменить: Бой начался" })).toBeDefined();
  });

  it("списка, фильтров и отметок схватки в журнале нет", async () => {
    const user = userEvent.setup();
    // Бой отмечен начатым до перехода: до него переключатель называется «Начать бой», и проверка
    // одного имени «Окончить бой» прошла бы при любой утечке. Ищем все имена сразу.
    await renderWithStores(<PlayScreen />, createThorne(), IN_FIGHT);
    await openJournal(user);

    expect(screen.queryByLabelText("Фильтры")).toBeNull();
    // Различающая здесь — проверка «Фильтры»: список пуст и без утечки, потому что режим «Журнал»
    // списка не отбирает вовсе. Проверка списка стоит страховкой от обратного.
    expect(screen.queryByRole("list", { name: /Заклинания/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Реакции" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /^(Начать бой|Окончить бой|Новый ход)/ }),
    ).toBeNull();
  });

  it("шапки ресурсов в журнале нет вовсе (FR-220)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);

    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    await openJournal(user);

    // Ни ячеек, ни чисел боя, ни номера раунда: журнал отвечает, что уже случилось.
    expect(screen.queryByRole("region", { name: "Ресурсы" })).toBeNull();
    expect(screen.queryByLabelText("Ячейки заклинаний")).toBeNull();
    expect(screen.queryByLabelText("Действие доступно")).toBeNull();
    expect(screen.queryByText(/Раунд/)).toBeNull();
  });

  it("действующего в журнале нет: журнал — только записи (FR-220)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />, concentrating());

    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();

    await openJournal(user);

    expect(screen.queryByRole("button", { name: /Концентрация/ })).toBeNull();
    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();
  });
});
