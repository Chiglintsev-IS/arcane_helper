// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { GameScreen } from "@/ui/screens/game/ui/GameScreen";
import type { CharacterState } from "@/core/domain/assembly/state";
import { renderWithStores, shown } from "@/ui/app/testing/stores";
import { createWizard, withoutRunes } from "@/core/infrastructure/catalog/thorne/fixtures";

function concentrating(): CharacterState {
  return {
    ...createWizard(),
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

async function openPanel(): Promise<void> {
  await renderWithStores(<GameScreen />, concentrating());
  await userEvent.click(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ }));
}

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

describe("строка действующего (FR-082, FR-084)", () => {
  it("без концентрации строка остаётся и говорит, что ничего не действует", async () => {
    await renderWithStores(<GameScreen />);

    expect(screen.getByRole("button", { name: "Действует: ничего" })).toBeDefined();
  });

  it("называет то, что держится, и ведёт к подробностям", async () => {
    await renderWithStores(<GameScreen />, concentrating());

    const line = screen.getByLabelText("Действует");
    expect(within(line).getByText(/Обнаружение магии/)).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ }));
    expect(screen.getByRole("dialog", { name: "Действует" })).toBeDefined();
  });
});

describe("лист концентрации (FR-084, FR-091)", () => {
  it("объясняет, как работает и чем прерывается", async () => {
    await openPanel();

    const panel = screen.getByRole("dialog", { name: "Действует" });
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

    const check = within(screen.getByRole("dialog", { name: /^Проверка концентрации/ }));
    expect(check.getByText(/Знаки ограждения/)).toBeDefined();
    expect(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ })).toBeDefined();
  });

  it("без руны провал завершает концентрацию сразу", async () => {
    const character = withoutRunes(concentrating());
    await damage("24", character);

    await userEvent.click(screen.getByRole("button", { name: "Провал" }));

    expect(screen.getByRole("button", { name: "Действует: ничего" })).toBeDefined();
  });
});

describe("ручной статус (FR-236)", () => {
  it("пустая отправка ничего не заводит", async () => {
    await renderWithStores(<GameScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Действует: ничего" }));
    await userEvent.click(screen.getByRole("button", { name: "Новый статус" }));
    await userEvent.type(screen.getByLabelText("Новый статус"), "   {Enter}");

    expect(screen.queryByLabelText("Активные эффекты")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Правка: Новый статус" })).toBeNull();
  });

  it("статус пишут на странице набора, и он встаёт в список действующего", async () => {
    await renderWithStores(<GameScreen />);

    await userEvent.click(screen.getByRole("button", { name: "Действует: ничего" }));
    await userEvent.click(screen.getByRole("button", { name: "Новый статус" }));
    const page = screen.getByRole("dialog", { name: "Правка: Новый статус" });
    await userEvent.type(within(page).getByLabelText("Новый статус"), "Опутан");
    await userEvent.click(within(page).getByRole("button", { name: "Записать" }));

    expect(screen.queryByRole("dialog", { name: "Правка: Новый статус" })).toBeNull();
    expect(within(screen.getByLabelText("Активные эффекты")).getByText(/Опутан/)).toBeDefined();
  });
});

async function stepAdjustment(direction: "больше" | "меньше", times: number): Promise<void> {
  for (let step = 0; step < times; step += 1) {
    await userEvent.click(screen.getByRole("button", { name: `Поправка: на единицу ${direction}` }));
  }
}

describe("поправка к КД (FR-236)", () => {
  it("заводится и меняет итоговый КД тем же способом, что и временные хиты", async () => {
    await renderWithStores(<GameScreen />);

    const numbers = screen.getByLabelText("Ресурсы");
    expect(screen.getByRole("button", { name: /^КД 14/ })).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    const dialog = screen.getByRole("dialog", { name: "КД" });
    await stepAdjustment("больше", 2);
    expect(within(dialog).getByRole("status").textContent).toBe("+2");
    await userEvent.click(within(dialog).getByRole("button", { name: "Подтвердить" }));

    expect(screen.queryByRole("dialog", { name: "КД" })).toBeNull();
    expect(within(numbers).getByText("16")).toBeDefined();
    expect(within(numbers).getByRole("button", { name: /^КД 16\. Поправка/ })).toBeDefined();
    expect(within(numbers).getByText("КД +2")).toBeDefined();
  });

  it("отрицательная поправка набирается без клавиатуры, печатается типографским минусом и снижает КД", async () => {
    await renderWithStores(<GameScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await stepAdjustment("меньше", 3);
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(within(numbers).getByText("11")).toBeDefined();
    expect(within(numbers).getByText("КД −3")).toBeDefined();
  });

  it("новое значение заменяет прежнее, а не складывается с ним", async () => {
    await renderWithStores(<GameScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await stepAdjustment("больше", 2);
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    expect(screen.getByRole("status").textContent).toBe("+2");
    await stepAdjustment("больше", 3);
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(screen.getByRole("button", { name: /^КД 19/ })).toBeDefined();
    expect(within(numbers).getByText("КД +5")).toBeDefined();
    expect(within(numbers).queryByText("КД +2")).toBeNull();
  });

  it("ноль снимает поправку вовсе", async () => {
    await renderWithStores(<GameScreen />);

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await stepAdjustment("больше", 2);
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    await userEvent.click(screen.getByRole("button", { name: /^КД/ }));
    await stepAdjustment("меньше", 2);
    await userEvent.click(screen.getByRole("button", { name: "Подтвердить" }));

    const numbers = screen.getByLabelText("Ресурсы");
    expect(screen.getByRole("button", { name: /^КД 14/ })).toBeDefined();
    expect(within(numbers).queryByText(/КД [+−]/)).toBeNull();
  });
});

describe("правка хитов — не урон", () => {
  it("хиты, поправленные числом, встают как есть, и проверки концентрации нет", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<GameScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /^Хиты/ }));
    await user.click(screen.getByRole("radio", { name: "Правка" }));
    await user.clear(screen.getByLabelText("Текущие хиты"));
    await user.type(screen.getByLabelText("Текущие хиты"), "45");
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(shown(stores).sheet.hitPoints.current).toBe(45);
    expect(screen.queryByRole("dialog", { name: "Хиты" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: /^Проверка концентрации/ })).toBeNull();
    expect(shown(stores).concentration).toBeDefined();
  });

  it("хитов больше максимума не записать: отказ стоит в шторке", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<GameScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /^Хиты/ }));
    await user.click(screen.getByRole("radio", { name: "Правка" }));
    await user.clear(screen.getByLabelText("Текущие хиты"));
    await user.type(screen.getByLabelText("Текущие хиты"), "99");
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const sheet = screen.getByRole("dialog", { name: "Хиты" });
    expect(within(sheet).getByRole("alert").textContent).not.toBe("");
    expect(shown(stores).sheet.hitPoints.current).toBe(60);
  });
});
