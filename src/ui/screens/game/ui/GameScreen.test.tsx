// @vitest-environment jsdom

/**
 * «Игра» на настоящем состоянии и настоящих операциях: моков нет — иначе прогон подтверждает
 * поведение мока.
 *
 * Экран проверяется сам по себе, без оболочки: всё, что здесь названо, он рисует и делает сам.
 * Проверки, которым нужен переход на соседний экран, живут у оболочки — там же, где живёт переход.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { renderWithStores, shown, slotsLeft, spell } from "@/ui/app/testing/stores";
import { GameScreen } from "@/ui/screens/game/ui/GameScreen";
import {
  withBloodExchange,
  withBloodSpent,
  withDamage,
  withSpentSlots,
  withoutSlots,
} from "@/core/infrastructure/catalog/thorne/fixtures";

/** Бой отмечен начатым: только тогда ведётся учёт хода. */
const IN_FIGHT = { inFight: true } as const;

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

describe("состав экрана (FR-001, AC-14)", () => {
  it("показывает производные числа и ячейки, но не имя с классом (FR-001)", async () => {
    await renderWithStores(<GameScreen />);

    // Имени, класса и уровня в шапке нет: их место — «Лист».
    expect(screen.queryByRole("heading", { name: "Торн" })).toBeNull();
    expect(screen.queryByText(/Волшебник, 7 уровень/)).toBeNull();

    // КД: 10 базы + 2 Ловкости + 2 предметов. Чисел заклинателя в шапке нет — их называет строка
    // действия, а шапка о том, что тратится и чем защищаются.
    expect(screen.getByRole("button", { name: /^КД 14/ })).toBeDefined();
    expect(within(screen.getByLabelText("Ресурсы")).queryByText("Атака")).toBeNull();

    const paying = screen.getByLabelText("Чем платить");
    // Четыре уровня ячеек и три пула: вопрос у них один, и ряд поэтому один.
    expect(within(paying).getAllByRole("listitem")).toHaveLength(7);
    expect(within(paying).getAllByText("4/4").length).toBeGreaterThan(0);
  });

  it("вне боя не показывает экономию действий (FR-001, FR-143)", async () => {
    // Вне боя ходов нет: правила отвечают «всё доступно» независимо от журнала, и
    // значки сообщали бы не состояние, а неправду.
    await renderWithStores(<GameScreen />);

    expect(screen.queryByLabelText("Действие доступно")).toBeNull();
    expect(screen.queryByRole("button", { name: /Реакция доступна/ })).toBeNull();
  });

  it("показывает все три вида экономии, когда все три есть в списке (FR-001)", async () => {
    // Бонусное действие появилось вместе с «Туманным шагом»: значку стало что отражать, и
    // переключатель вернулся сам, без правки интерфейса.
    await renderWithStores(<GameScreen />, createThorne(), IN_FIGHT);

    expect(screen.getByLabelText("Действие доступно")).toBeDefined();
    // Остаток реакции стоит на кнопке, которой её и тратят.
    expect(screen.getByRole("button", { name: /^Реакции\. Реакция доступна/ })).toBeDefined();
    expect(screen.getByLabelText("Бонусное действие доступно")).toBeDefined();
  });

  it("вида действия, которого в списке нет, в шапке тоже нет (FR-001)", async () => {
    // Снимаем «Туманный шаг» с подготовки — бонусных заклинаний в бою не остаётся.
    const character = {
      ...createThorne(),
      preparedSpellIds: createThorne().preparedSpellIds.filter((id) => id !== "misty-step"),
    };
    await renderWithStores(<GameScreen />, character);

    expect(screen.queryByLabelText("Бонусное действие доступно")).toBeNull();
  });

  it("показывает активную концентрацию карточкой с механикой (FR-084)", async () => {
    // Состав карточки проверяется в Concentration.test.tsx; здесь — что шапка её вообще показывает.
    await renderWithStores(<GameScreen />, concentrating());
    expect(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ })).toBeDefined();
  });

  it("КД меняется после применения «Доспехов мага»: 14 → 17 (FR-093)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    expect(screen.getByRole("button", { name: /^КД 14/ })).toBeDefined();

    // Применение проверяется в начатом бою: до «Начать бой» причина добавила бы лишний
    // шаг мастера, а этот тест — про КД, а не про сам факт начала боя.
    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.getByRole("button", { name: /^КД 17/ })).toBeDefined();
    // Вклад подписан на строке эффекта: игрок видит, откуда взялось новое число.
    expect(screen.getByText(/Доспехи мага · КД 17/)).toBeDefined();
  });

  it("израсходованная реакция видна ярлыком, а её состояние — доступным именем (FR-144)", async () => {
    const { stores } = await renderWithStores(<GameScreen />, createThorne(), IN_FIGHT);

    // Реакция считается потраченной по журналу: отмечаем её расход применением «Щита».
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /Щит/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(shown(stores).turn.reactionAvailable).toBe(false);
    const spent = screen.getByRole("button", { name: /^Реакции\. Реакция израсходована/ });
    expect(within(spent).getByText("израсходована")).toBeDefined();
  });

});

describe("шапка «Игры» (FR-201, FR-232)", () => {
  it("начало боя убирает то, чем в ход не сходить (FR-201)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));

    const list = within(screen.getByLabelText(/^Заклинания/));
    expect(list.getByText("Луч холода")).toBeDefined();
    expect(list.queryByText("Починка")).toBeNull();
    expect(list.queryByText("Поиск фамильяра")).toBeNull();
    // Неподготовленный ритуал уходит совсем: ячейкой его не сотворить.
    expect(list.queryByText("Обнаружение магии")).toBeNull();
  });

  it("чисел заклинателя в шапке нет: их называет строка действия", async () => {
    await renderWithStores(<GameScreen />);

    const header = within(screen.getByLabelText("Ресурсы"));
    expect(header.queryByText("КС")).toBeNull();
    expect(header.queryByText("Атака")).toBeNull();
    // Число, которое игрок называет мастеру, стоит там, где он выбирает заклинание.
    const row = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(row.getByText("Атака d20+8")).toBeDefined();
  });

  it("кости хитов шапка называет и в бою, и вне его (FR-134)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    const paying = () => within(screen.getByLabelText("Чем платить"));
    expect(paying().getByText("Кости d6")).toBeDefined();

    // Закреплённая часть с началом боя не меняется: плитке незачем прыгать.
    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    expect(paying().getByText("Кости d6")).toBeDefined();
  });

  it("постоянное стоит плиткой, а не значком (FR-232)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    // Числа, которые за бой не меняются, стоят плитками закреплённой части.
    const header = within(screen.getByLabelText("Ресурсы"));
    expect(header.getByText("Внимательность")).toBeDefined();
    const paying = within(screen.getByLabelText("Чем платить"));
    expect(paying.getByText("Кости d6")).toBeDefined();
    expect(paying.getByText("Руны")).toBeDefined();
    // Очков у Торна нет, пока он не разменял кровь: пустой пул носит знак отказа.
    expect(paying.getByText(/Очки/).textContent).toContain("✗");
    expect(screen.queryByText(/Инициатива/)).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));

    // Начавшийся бой ни одну плитку не сдвинул: значком пришло только то, что случилось.
    const badges = within(screen.getByLabelText("Прочие ресурсы"))
      .getAllByRole("listitem")
      .map((item) => item.textContent ?? "");
    // Начавшийся бой ни одной плитки не сдвинул, а его числа встали на кнопки, которыми ходят.
    expect(badges.join(" ")).not.toContain("Кости");
    expect(badges.join(" ")).not.toContain("Внимательность");
    expect(screen.getByRole("button", { name: /^Новый ход.*раунд 1/ })).toBeDefined();
  });

  it("истощение видно значком со ступенью (FR-232)", async () => {
    const marked = {
      ...createThorne(),
      exhaustion: 3,
    };
    await renderWithStores(<GameScreen />, marked);

    expect(screen.getByLabelText("Истощение: ступень 3")).toBeDefined();
  });

  it("вдохновение видно, когда оно есть (FR-232)", async () => {
    const marked = {
      ...createThorne(),
      inspiration: true,
    };
    await renderWithStores(<GameScreen />, marked);

    expect(screen.getByLabelText("Вдохновение")).toBeDefined();
  });

  it("отсутствующего шапка не показывает (FR-232)", async () => {
    await renderWithStores(<GameScreen />);

    expect(screen.queryByLabelText(/Истощение/)).toBeNull();
    expect(screen.queryByLabelText("Вдохновение")).toBeNull();
  });

  it("полоса фильтров стоит и в бою, и вне его: список есть всегда (FR-002)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    expect(screen.getByLabelText("Фильтры")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    expect(screen.getByLabelText("Фильтры")).toBeDefined();
  });

});

describe("фильтры (FR-002, FR-003, AC-07)", () => {
  it("фильтр по времени накладывания оставляет только подходящие заклинания", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

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
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: "Реакция" }));
    await user.click(screen.getByRole("button", { name: "Действие" }));

    const list = screen.getByLabelText(/^Заклинания/);
    expect(within(list).getAllByRole("listitem").length).toBeGreaterThan(2);
    expect(within(list).getByText("Щит")).toBeDefined();
    expect(within(list).getByText("Луч холода")).toBeDefined();
  });

  it("объясняет пустой результат, а не показывает пустой экран", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    // Реакции, которую держат вниманием, у Торна нет: ни одна из его реакций не концентрационная.
    await user.click(screen.getByRole("button", { name: "Реакция" }));
    await user.click(screen.getByRole("button", { name: "Концентрация" }));

    expect(screen.getByText(/не подходит ни одно заклинание/)).toBeDefined();
    // Кнопки сброса нет: выбранное снимают там же, где поставили.
    expect(screen.queryByRole("button", { name: /Сбросить/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Концентрация" }));
    expect(screen.getByLabelText(/^Заклинания/)).toBeDefined();
  });

});

describe("режим «Привал» и операции отдыха (FR-215, FR-237)", () => {
  it("«Прошёл час» доступен в «Игре» и в «Привале» одной и той же кнопкой (FR-173, FR-175)", async () => {
    const user = userEvent.setup();
    // Три очка кровью: 9 хитов и столько же максимума ушли, очки на месте.
    const reduced = withBloodExchange(createThorne(), 3);
    await renderWithStores(<GameScreen />, reduced);

    // Кнопка стоит прямо в «Игре»: входа в отдельный блок ей больше не нужно.
    await user.click(screen.getByRole("button", { name: /Прошёл час/ }));
    // На 7 уровне возвращается 3 за час: максимум 51 → 54, текущие не растут.
    expect(screen.getByLabelText("Ресурсы").textContent).toContain("51/54");
    expect(screen.getByLabelText("Чем платить").textContent).toContain("Очки");
  });

  it("бой запрещает час: кнопка остаётся видимой, но недоступной с причиной (FR-215)", async () => {
    const user = userEvent.setup();
    // Очки уже израсходованы: час вернёт только максимум, и подпись кнопки говорит ровно это.
    const reduced = withBloodSpent(createThorne(), 3);
    await renderWithStores(<GameScreen />, reduced);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));

    const button = screen.getByRole("button", {
      name: "Прошёл час · максимум +3 Пока идёт бой, час пройти не может",
    });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("вне боя нет ни «Нового хода», ни счётчика раундов (FR-221)", async () => {
    await renderWithStores(<GameScreen />);

    // «Начать бой» на месте: с неё бой и начинается. Хода вне боя нет, и раунда тоже.
    expect(screen.getByRole("button", { name: /^Начать бой/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: /Окончить бой|Новый ход/ })).toBeNull();
    expect(screen.queryByText(/^раунд \d+$/)).toBeNull();
  });

});

describe("повторяемое действие эффекта (FR-092)", () => {
  it("напоминает о ежеходной работе, пока эффект держится", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await user.click(screen.getByRole("button", { name: /^Отражения/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    // Ежеходная работа названа на самой строке: за раскрытием её забудут на втором раунде.
    const line = within(screen.getByLabelText("Действует"));
    expect(line.getByText(/Считать отражения/)).toBeDefined();
  });

  it("у эффекта без ежеходной работы напоминания нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await user.click(screen.getByRole("button", { name: /^Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const line = within(screen.getByLabelText("Действует"));
    expect(line.getByText(/Доспехи мага/)).toBeDefined();
    expect(line.queryByText(/↻/)).toBeNull();
  });

});

describe("ручная правка ресурсов (FR-071, FR-142, FR-155)", () => {
  it("плитка ячейки открывает правку и возвращает списанное", async () => {
    const user = userEvent.setup();
    const character = withSpentSlots(createThorne(), 1, 2);
    const { stores } = await renderWithStores(<GameScreen />, character);

    await user.click(screen.getByRole("button", { name: /Ячейки 1 уровня: 2 из 4/ }));
    await user.click(screen.getByRole("button", { name: "Вернуть: Ячейка 1 ур." }));

    expect(slotsLeft(stores, 1)).toBe(3);
  });

  it("за границы пула правка не пускает", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /Ячейки 1 уровня/ }));
    expect(screen.getByRole("button", { name: "Вернуть: Руны" })).toHaveProperty("disabled", true);
  });

});

describe("реакции (FR-060, FR-061, FR-062)", () => {
  it("вход одним нажатием, вопрос о событии первым", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /^Реакции/ }));

    const sheet = within(screen.getByRole("dialog", { name: /^Реакции/ }));
    expect(sheet.getByText("Что произошло?")).toBeDefined();
    // Список заклинаний до выбора события не показывается: игрок думает о событии, а не о названии.
    expect(screen.queryByLabelText("Подходящие реакции")).toBeNull();
  });

  it("событие находит своё заклинание и называет изменённое число (FR-062)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /^Реакции/ }));
    await user.click(screen.getByRole("radio", { name: "По мне попали" }));

    const matching = within(screen.getByLabelText("Подходящие реакции"));
    expect(matching.getByText("Щит")).toBeDefined();
    // Готовое число, а не формула: 14 базовых плюс 5.
    expect(matching.getByText("КД 19 вместо 14")).toBeDefined();
  });

  it("на событие без ответа переключателя нет (FR-002)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /^Реакции/ }));
    // «Искусная острота» в книгу не вошла — отвечать на успешный бросок врага нечем.
    expect(screen.queryByRole("radio", { name: "Враг преуспел в броске" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Я провалил спасбросок" })).toBeDefined();
  });

  it("выбор реакции открывает мастер применения (FR-022)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /^Реакции/ }));
    await user.click(screen.getByRole("radio", { name: "Враг творит заклинание" }));
    await user.click(
      within(screen.getByLabelText("Подходящие реакции")).getByRole("button", {
        name: /Контрзаклинание/,
      }),
    );

    expect(screen.getByRole("dialog", { name: /Применение/ })).toBeDefined();
    // До подтверждения состояние не тронуто.
    expect(shown(stores).journal).toHaveLength(0);
  });

  it("израсходованная реакция не прячет варианты, а объясняет причину (FR-031)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    // Тратим реакцию «Щитом», затем открываем экран реакций снова.
    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await user.click(screen.getByRole("button", { name: /^Щит/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    await user.click(screen.getByRole("button", { name: /^Реакции/ }));
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
    const { stores } = await renderWithStores(<GameScreen />, createThorne(), IN_FIGHT);

    await user.click(screen.getByRole("button", { name: /^Реакции/ }));
    await user.click(screen.getByRole("radio", { name: "Я провалил спасбросок" }));
    await user.click(screen.getByRole("button", { name: /Потратить руну/ }));

    expect(shown(stores).resources.runes.remaining).toBe(2);
    expect(shown(stores).turn.reactionAvailable).toBe(false);
  });

});

describe("конец боя (FR-216, FR-221)", () => {
  function wounded(): CharacterState {
    return withDamage(createThorne(), 48);
  }

  it("кнопка конца боя восстанавливает до половины максимума", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<GameScreen />, wounded());

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await user.click(screen.getByRole("button", { name: "Окончить бой" }));
    await user.click(screen.getByRole("button", { name: "Да, бой закончен" }));
    expect(shown(stores).sheet.hitPoints.current).toBe(30);
  });

  it("«нет, продолжается» ничего не меняет", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<GameScreen />, wounded());

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await user.click(screen.getByRole("button", { name: "Окончить бой" }));
    await user.click(screen.getByRole("button", { name: "Нет, продолжается" }));

    // 15, а не 12: начало боя — это первый ход, и регенерация тролля на нём сработала.
    expect(shown(stores).sheet.hitPoints.current).toBe(15);
    expect(shown(stores).journal.at(-1)?.kind).toBe("combat_started");
  });

  it("при полном здоровье бой всё равно можно закончить, но лечения не обещает", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await user.click(screen.getByRole("button", { name: "Окончить бой" }));

    // Конец боя — факт, а не лечение: он сбрасывает счёт раундов, и здоровому это нужно так же.
    const sheet = screen.getByRole("dialog", { name: "Бой закончен?" });
    expect(within(sheet).getByText(/Счёт раундов начнётся заново/)).toBeDefined();
    expect(within(sheet).queryByText(/здоровье поднимется/)).toBeNull();

    await user.click(within(sheet).getByRole("button", { name: "Да, бой закончен" }));
    expect(shown(stores).journal.at(-1)?.kind).toBe("combat_ended");
  });

  it("отметки схватки (FR-221)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    // Пока бой не начат, заканчивать нечего, и ходов не бывает: «Нового хода» на экране нет.
    expect(screen.queryByRole("button", { name: "Окончить бой" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Новый ход/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));

    expect(screen.queryByRole("button", { name: /^Начать бой/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Окончить бой" })).toBeDefined();
    expect(screen.getByRole("button", { name: /^Новый ход/ })).toBeDefined();
  });

  it("следующий бой начинается с первого раунда", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    await user.click(screen.getByRole("button", { name: /^Новый ход/ }));
    expect(screen.getByText("раунд 2")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Окончить бой" }));
    await user.click(screen.getByRole("button", { name: "Да, бой закончен" }));

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));
    expect(screen.getByText("раунд 1")).toBeDefined();
  });

});

describe("магия крови в списке действий (FR-207)", () => {
  it("стоит в бою среди заклинаний и подчиняется тем же фильтрам", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    expect(screen.getByRole("button", { name: /Магия крови/ })).toBeDefined();

    // Она тратит действие, значит фильтр действия её оставляет…
    await user.click(screen.getByRole("button", { name: "Действие" }));
    expect(screen.getByRole("button", { name: /Магия крови/ })).toBeDefined();

    // …а фильтр реакции убирает: строка, остающаяся при любом фильтре, делает список лживым.
    await user.click(screen.getByRole("button", { name: "Действие" }));
    await user.click(screen.getByRole("button", { name: "Реакция" }));
    expect(screen.queryByRole("button", { name: /Магия крови/ })).toBeNull();
  });

});

describe("подготовка правится только в «Книге» (FR-214)", () => {
  it("в «Игре» подготовку не меняют: состав уже определён", async () => {
    await renderWithStores(<GameScreen />);
    expect(screen.queryByRole("button", { name: /^Подготовить: / })).toBeNull();
    expect(screen.queryByText(/Подготовлено \d+ из/)).toBeNull();
  });
});

describe("краткая карточка (FR-010)", () => {
  it("показывает время, цену, дальность и пересказ эффекта", async () => {
    await renderWithStores(<GameScreen />);
    const row = screen.getByRole("button", { name: /Луч холода/ });

    // Цену говорит строка стоимости, а не значок.
    expect(within(row).getByText("Без ячейки")).toBeDefined();
    expect(within(row).getByText("Действие")).toBeDefined();
    expect(within(row).getByText("60 футов")).toBeDefined();
    expect(within(row).getByText(spell("ray-of-frost").shortRulesRu)).toBeDefined();
  });

  it("разрешение называет число, а не вид броска (FR-211)", async () => {
    await renderWithStores(<GameScreen />);

    // Название проверки и число вместе: «Атака» без числа — половина ответа, «d20+8» без названия
    // не связывается с тем, что скажет мастер.
    const row = within(screen.getByRole("button", { name: /Луч холода/ }));
    expect(row.getByText("Атака d20+8")).toBeDefined();
  });

  it("называет минимальную стоимость применения", async () => {
    await renderWithStores(<GameScreen />);

    // «Поглощение стихий» растёт с уровнем ячейки — «от» обещает выгоду, и она есть.
    expect(
      within(screen.getByRole("button", { name: /Поглощение стихий/ })).getByText(
        "Ячейка от 1 ур.",
      ),
    ).toBeDefined();
  });

  it("не обещает выгоды от ячейки повыше там, где её нет (FR-010)", async () => {
    // «Доспехи мага» с ячейки 3 уровня работают ровно как с первой: «от» звало бы тратить зря.
    await renderWithStores(<GameScreen />);

    const row = within(screen.getByRole("button", { name: /Доспехи мага/ }));
    expect(row.getByText("Ячейка 1 ур.")).toBeDefined();
    expect(row.queryByText("Ячейка от 1 ур.")).toBeNull();
  });

  it("недоступное заклинание объясняет причину словами", async () => {
    // Ячейки 1 уровня не хватило бы: заклинание можно поднять до 4 уровня или оплатить кровью,
    // поэтому недоступным оно становится только когда не осталось ни одного способа.
    const character = withoutSlots(createThorne());
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />, character);
    // Бой начат: тест проверяет причину нехватки ячеек, а не причину — иначе она заслонила
    // бы собой то, ради чего написан этот тест.
    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));

    const row = screen.getByRole("button", { name: /Доспехи мага/ });
    expect(within(row).getByText(/Нет свободной ячейки 1 уровня/)).toBeDefined();
  });

});

describe("учёт хода и отмена (FR-111, FR-143)", () => {
  it("«Новый ход» восстанавливает израсходованное", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<GameScreen />, createThorne(), IN_FIGHT);

    await user.click(screen.getByRole("button", { name: /Доспехи мага/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(screen.getByLabelText("Действие израсходовано")).toBeDefined();

    await user.click(screen.getByRole("button", { name: /^Новый ход/ }));
    expect(screen.getByLabelText("Действие доступно")).toBeDefined();
    expect(shown(stores).turn.actionAvailable).toBe(true);
  });

  it("«Щит» сам исчезает с началом следующего хода, КД возвращается к 14 (FR-094)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />, createThorne(), IN_FIGHT);

    await user.click(screen.getByRole("button", { name: /Щит/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.getByRole("button", { name: /^КД 19/ })).toBeDefined();

    await user.click(screen.getByRole("button", { name: /^Новый ход/ }));

    // Пока строка эффекта висит, шапка показывает КД 19 — число, которое игрок называет мастеру.
    expect(screen.queryByText(/Щит · КД 19/)).toBeNull();
    expect(screen.getByRole("button", { name: /^КД 14/ })).toBeDefined();
  });

});

describe("подробная карточка (FR-011, FR-012)", () => {
  it("строка «Разрешение» показывает атаку заклинанием общей подписью (FR-211)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /Луч холода/ }));
    const attackCard = screen.getByRole("dialog", { name: /Луч холода/ });
    expect(within(attackCard).getByText("Разрешение").nextElementSibling?.textContent).toBe(
      "Атака d20+8",
    );
  });

  it("полные правила и отыгрыш закрыты по умолчанию", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /Луч холода/ }));
    const card = screen.getByRole("dialog", { name: /Луч холода/ });

    const fullRules = within(card).getByText("Полные правила").closest("details");
    const roleplay = within(card).getByText("Отыгрыш").closest("details");
    expect(fullRules?.hasAttribute("open")).toBe(false);
    expect(roleplay?.hasAttribute("open")).toBe(false);
  });

  it("техническая инструкция доступна за два нажатия (M-02)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /Луч холода/ }));
    await user.click(screen.getByText("Как объявить"));

    expect(screen.getByText(/Атака заклинанием, модификатор \+8/)).toBeDefined();
  });

  it("заметка сохраняется в состоянии и не попадает в журнал", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /Щит/ }));
    await user.type(screen.getByLabelText("Заметка"), "гасит и стрелу");

    expect(shown(stores).spells.find((row) => row.id === "shield")?.note).toBe("гасит и стрелу");
    expect(shown(stores).journal).toHaveLength(0);
  });

});

describe("схема ритуала (FR-192)", () => {
  it("у неритуального заклинания кнопки схемы нет", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(
      within(screen.getByLabelText(/^Заклинания/)).getByRole("button", { name: /Луч холода/ }),
    );

    expect(screen.queryByRole("button", { name: "Схема ритуала" })).toBeNull();
  });

});

describe("признак «под солнцем» (FR-181, FR-183)", () => {
  it("переключается из правки ресурсов и подавляет особенности", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /Ячейки 1 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Под прямым солнечным светом" }));

    expect(shown(stores).resources.suppression.underDirectSunlight).toBe(true);
  });

  it("включённый признак виден значком в шапке, а не только внутри листа", async () => {
    const sunlit = {
      ...createThorne(),
      suppression: { firedUponTurnStarts: 0, underDirectSunlight: true },
    };
    await renderWithStores(<GameScreen />, sunlit);

    const resources = screen.getByLabelText("Прочие ресурсы");
    expect(
      within(resources).getByText("Особенности подавлены: солнечный свет"),
    ).toBeDefined();
  });

  it("выключается тем же переключателем", async () => {
    const user = userEvent.setup();
    const sunlit = {
      ...createThorne(),
      suppression: { firedUponTurnStarts: 0, underDirectSunlight: true },
    };
    const { stores } = await renderWithStores(<GameScreen />, sunlit);

    await user.click(screen.getByRole("button", { name: /Ячейки 1 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Под прямым солнечным светом" }));

    expect(shown(stores).resources.suppression.underDirectSunlight).toBe(
      false,
    );
  });

});

describe("«Книга» говорит только о книге (FR-217)", () => {
  it("в «Игре» шапка на месте и в бою, и вне его", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    const outOfFight = screen.getByLabelText("Чем платить");
    expect(screen.getByRole("region", { name: "Ресурсы" })).toBeDefined();
    expect(outOfFight.textContent).toContain("Руны");
    expect(outOfFight.textContent).toContain("3/3");
    expect(outOfFight.textContent).toContain("Очки");

    await user.click(screen.getByRole("button", { name: /^Начать бой/ }));

    const inFight = screen.getByLabelText("Чем платить");
    expect(screen.getByRole("region", { name: "Ресурсы" })).toBeDefined();
    expect(inFight.textContent).toContain("Руны");
    expect(inFight.textContent).toContain("3/3");
    expect(inFight.textContent).toContain("Очки");
  });

});

describe("«Знаки ограждения» вне боя (FR-153)", () => {
  it("вне боя лист предлагает руну: триггер приходит и до схватки", async () => {
    const user = userEvent.setup();
    await renderWithStores(<GameScreen />);

    await user.click(screen.getByRole("button", { name: /^Реакции/ }));

    const sheet = screen.getByRole("dialog", { name: /^Реакции/ });
    await user.click(within(sheet).getByRole("radio", { name: /провалил спасбросок/i }));

    await user.click(within(sheet).getByRole("button", { name: /Потратить руну/ }));

    expect(screen.getByLabelText("Чем платить").textContent).toContain("2/3");
  });

});
