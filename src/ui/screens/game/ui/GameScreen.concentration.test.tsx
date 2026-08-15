// @vitest-environment jsdom

/**
 * Блок концентрации, ввод урона, статусы и поправка к КД — всё это «Игра» рисует и делает сама.
 * Состояние настоящее, операции настоящие: моков нет.
 *
 * Проверки, которым нужна запись журнала, живут у оболочки: журнал — соседний экран, и переход к
 * нему принадлежит ей.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { GameScreen } from "@/ui/screens/game/ui/GameScreen";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { renderWithStores } from "@/ui/app/testing/stores";
import { withoutRunes } from "@/core/infrastructure/catalog/thorne/fixtures";

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

/** Лист концентрации открывается с карточки в шапке. */
async function openPanel(): Promise<void> {
  await renderWithStores(<GameScreen />, concentrating());
  await userEvent.click(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ }));
}

/** Ввод урона: он же вход в проверку концентрации, когда она идёт. */
async function damage(
  amount: string,
  character: CharacterState = concentrating(),
  situation: { inFight?: boolean } = {},
): Promise<void> {
  await renderWithStores(<GameScreen />, character, situation);
  await userEvent.click(screen.getByRole("button", { name: /^Хиты/ }));
  await userEvent.type(screen.getByLabelText("Полученный урон"), amount);
  await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));
}

describe("карточка концентрации в шапке (FR-082, FR-084)", () => {
  it("без концентрации карточки нет вовсе", async () => {
    // Ряд нескролящейся шапки не тратится на сообщение об отсутствии.
    await renderWithStores(<GameScreen />);

    expect(screen.queryByLabelText("Концентрация")).toBeNull();
  });

  it("показывает название, ячейку, механику и чем сорвётся", async () => {
    await renderWithStores(<GameScreen />, concentrating());

    const block = screen.getByLabelText("Концентрация");
    expect(within(block).getByText("Обнаружение магии")).toBeDefined();
    expect(within(block).getByText(/ячейка 1 ур\./)).toBeDefined();
    expect(within(block).getByText(/Сфера 30 футов от себя · Без броска/)).toBeDefined();
    expect(within(block).getByText(/спасбросок Телосложения \+4, КС от 10/)).toBeDefined();
  });

  it("карточка нажимаема и ведёт к подробностям", async () => {
    await renderWithStores(<GameScreen />, concentrating());

    const card = screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ });
    await userEvent.click(card);

    expect(screen.getByRole("dialog", { name: /Концентрация/ })).toBeDefined();
  });

});

describe("лист концентрации (FR-084, FR-091)", () => {
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

});

describe("ввод урона (FR-083, FR-180, FR-183)", () => {
  it("списывает хиты и без активной концентрации", async () => {
    await renderWithStores(<GameScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^Хиты/ }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "12");
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.getByText("48/60")).toBeDefined();
    expect(screen.queryByText(/Проверка концентрации/)).toBeNull();
  });

  it("отмечает подавление особенностей огнём", async () => {
    await renderWithStores(<GameScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^Хиты/ }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "5");
    await userEvent.click(screen.getByLabelText("Урон огнём"));
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.getByText(/Особенности подавлены: урон огнём/)).toBeDefined();
  });

  it("при активной концентрации предлагает проверку с готовой КС", async () => {
    await renderWithStores(<GameScreen />, concentrating());

    await userEvent.click(screen.getByRole("button", { name: /^Хиты/ }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "24");
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    const check = screen.getByRole("dialog", { name: /^Проверка концентрации/ });
    expect(within(check).getByText(/КС 12/)).toBeDefined();
    expect(within(check).getByText(/нужно 8 и выше/)).toBeDefined();
  });

  it("проверка концентрации: имя шторки — её заголовок (FR-274)", async () => {
    await renderWithStores(<GameScreen />, concentrating());

    await userEvent.click(screen.getByRole("button", { name: /^Хиты/ }));
    await userEvent.type(screen.getByLabelText("Полученный урон"), "24");
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    const check = screen.getByRole("dialog", { name: /^Проверка концентрации/ });
    const title = within(check).getByRole("heading");

    // Заголовок называет и проверку, и заклинание, которое ею держат: имя шторки — он сам.
    expect(check.getAttribute("aria-labelledby")).toBe(title.id);
    expect(check.hasAttribute("aria-label")).toBe(false);
    expect(title.textContent).toContain("Обнаружение магии");
  });

  it("не принимает ноль и не пишет пустую запись", async () => {
    await renderWithStores(<GameScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^Хиты/ }));
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.getByText("60/60")).toBeDefined();
  });

});

describe("проверка концентрации (FR-083, FR-154)", () => {
  it("провал при доступной руне сначала предлагает Знаки ограждения", async () => {
    await damage("24");

    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    expect(screen.getByText(/Знаки ограждения/)).toBeDefined();
    // Эффект ещё держится: предложение обязано появиться до завершения.
    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
  });

  it("без руны провал завершает концентрацию сразу", async () => {
    const character = withoutRunes(concentrating());
    await damage("24", character);

    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    expect(screen.queryByLabelText("Концентрация")).toBeNull();
  });

});

describe("ручной статус (FR-236)", () => {
  it("пустая отправка ничего не заводит", async () => {
    await renderWithStores(<GameScreen />);

    const field = screen.getByLabelText("Новый статус");
    await userEvent.type(field, "   {Enter}");

    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();
  });

});

describe("поправка к КД (FR-236)", () => {
  it("заводится и меняет итоговый КД тем же способом, что и временные хиты", async () => {
    await renderWithStores(<GameScreen />);

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("14")).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    const dialog = screen.getByRole("dialog", { name: "КД" });
    await userEvent.type(within(dialog).getByLabelText("Поправка"), "2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Подтвердить" }));

    expect(screen.queryByRole("dialog", { name: "КД" })).toBeNull();
    expect(within(numbers).getByText("16")).toBeDefined();
    expect(within(numbers).getByRole("button", { name: /^КД 16\. Правка: поправка/ })).toBeDefined();
    expect(within(numbers).getByText("КД +2")).toBeDefined();
  });

  it("отрицательная поправка печатается типографским минусом и снижает КД", async () => {
    await renderWithStores(<GameScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await userEvent.type(screen.getByLabelText("Поправка"), "-3");
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("11")).toBeDefined();
    expect(within(numbers).getByText("КД −3")).toBeDefined();
  });

  it("новое значение заменяет прежнее, а не складывается с ним", async () => {
    await renderWithStores(<GameScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await userEvent.type(screen.getByLabelText("Поправка"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await userEvent.clear(screen.getByLabelText("Поправка"));
    await userEvent.type(screen.getByLabelText("Поправка"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("19")).toBeDefined();
    expect(within(numbers).getByText("КД +5")).toBeDefined();
    expect(within(numbers).queryByText("КД +2")).toBeNull();
  });

  it("ноль снимает поправку вовсе", async () => {
    await renderWithStores(<GameScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await userEvent.type(screen.getByLabelText("Поправка"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await userEvent.clear(screen.getByLabelText("Поправка"));
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("14")).toBeDefined();
    expect(within(numbers).queryByText(/КД [+−]/)).toBeNull();
  });

});
