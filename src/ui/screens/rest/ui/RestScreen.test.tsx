// @vitest-environment jsdom

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { renderWithStores, shown, slotsLeft } from "@/ui/app/testing/stores";
import { RestScreen } from "@/ui/screens/rest/ui/RestScreen";
import {
  withBloodPaid,
  withDamage,
  withSpentSlots,
  withoutArcaneRecovery,
} from "@/core/infrastructure/catalog/thorne/fixtures";

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

describe("шторки «Привала» (FR-205, FR-237)", () => {
  it("плитка КД открывает правку поправки и доводит её до итога", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RestScreen />);

    await user.click(screen.getByRole("button", { name: /^КД 14/ }));
    const sheet = screen.getByRole("dialog", { name: "КД" });
    await user.type(within(sheet).getByLabelText("Поправка"), "2");
    await user.click(within(sheet).getByRole("button", { name: "Подтвердить" }));

    expect(screen.queryByRole("dialog", { name: "КД" })).toBeNull();
    expect(screen.getByRole("button", { name: /^КД 16/ })).toBeDefined();
  });

  it("плитка хитов открывает правку урона и списывает хиты", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RestScreen />);

    await user.click(screen.getByRole("button", { name: /^Хиты/ }));
    await user.type(screen.getByLabelText("Полученный урон"), "12");
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.getByText("48/60")).toBeDefined();
  });

  it("плитка ячейки открывает ручную правку ресурсов", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RestScreen />);

    await user.click(screen.getByRole("button", { name: /^Ячейки 1 уровня/ }));
    const sheet = screen.getByRole("dialog", { name: "Правка ресурсов" });
    await user.click(within(sheet).getByRole("button", { name: "Потратить: Ячейка 1 ур." }));

    expect(slotsLeft(stores, 1)).toBe(3);
  });

  it("строка действующего открывает шторку и снимает концентрацию", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RestScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ }));
    const panel = screen.getByRole("dialog", { name: "Действует" });
    await user.click(within(panel).getByRole("button", { name: "Снять концентрацию" }));

    expect(shown(stores).concentration).toBeUndefined();
  });

  it("перехода к полным правилам на «Привале» нет: подробная карточка живёт в других режимах", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RestScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ }));

    expect(screen.queryByRole("button", { name: /Полные правила/ })).toBeNull();
  });

  it("урон, полученный на привале, предлагает проверку концентрации", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RestScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /^Хиты/ }));
    await user.type(screen.getByLabelText("Полученный урон"), "24");
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const check = screen.getByRole("dialog", { name: /^Проверка концентрации/ });
    expect(within(check).getByText(/КС 12/)).toBeDefined();
  });

  it("провал проверки снимает концентрацию с привала так же, как из боя", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RestScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /^Хиты/ }));
    await user.type(screen.getByLabelText("Полученный урон"), "24");
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    await user.click(screen.getByRole("button", { name: "Провал" }));
    await user.click(screen.getByRole("button", { name: "Всё равно провал" }));

    expect(shown(stores).concentration).toBeUndefined();
    expect(screen.queryByRole("dialog", { name: /^Проверка концентрации/ })).toBeNull();
  });
});

describe("режим «Привал» и операции отдыха (FR-215, FR-237)", () => {
  async function atCamp(character: CharacterState = createThorne()) {
    return renderWithStores(<RestScreen />, withSpentSlots(character, 1, 2));
  }
  it("показывает ресурсы и активные эффекты, но не список заклинаний (FR-237)", async () => {
    await atCamp(concentrating());

    expect(screen.getByLabelText("Ресурсы")).toBeDefined();
    expect(screen.getByRole("button", { name: /^Действует: Обнаружение магии/ })).toBeDefined();
    expect(screen.queryByLabelText(/^Заклинания/)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Реакции/ })).toBeNull();
    expect(screen.queryByLabelText(/^Подготовлено/)).toBeNull();
    expect(screen.queryByRole("button", { name: /^(Начать бой|Окончить бой|Новый ход)/ })).toBeNull();
  });

  it("короткий отдых доступен кнопкой и пишется в лог", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Короткий отдых/ }));

    expect(shown(stores).log.at(-1)?.kind).toBe("short_rest");
  });

  it("долгий отдых требует подтверждения и возвращает ячейки (FR-133)", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Долгий отдых/ }));
    expect(slotsLeft(stores, 1)).toBe(2);

    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(slotsLeft(stores, 1)).toBe(4);
  });

  it("отмена подтверждения ничего не меняет", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Долгий отдых/ }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(shown(stores).log).toHaveLength(0);
    expect(slotsLeft(stores, 1)).toBe(2);
  });

  it("магическое восстановление возвращает выбранные ячейки (FR-131)", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Короткий отдых/ }));
    await user.click(screen.getByRole("button", { name: /Магическое восстановление/ }));
    await user.click(screen.getByRole("button", { name: "Вернуть ячейку 1 уровня" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(slotsLeft(stores, 1)).toBe(3);
    expect(shown(stores).recovery.arcaneRecovery.remaining).toBe(3);
  });

  it("набранное сверх бюджета названо причиной, а не отменено молча (FR-131)", async () => {
    const user = userEvent.setup();
    const spent = withSpentSlots(withSpentSlots(createThorne(), 4, 1), 1, 1);
    await atCamp(spent);

    await user.click(screen.getByRole("button", { name: /Короткий отдых/ }));
    await user.click(screen.getByRole("button", { name: /Магическое восстановление/ }));
    await user.click(screen.getByRole("button", { name: "Вернуть ячейку 4 уровня" }));
    expect(
      screen.getByRole("button", { name: "Подтвердить" }).hasAttribute("disabled"),
    ).toBe(false);

    await user.click(screen.getByRole("button", { name: "Вернуть ячейку 1 уровня" }));
    expect(screen.getByText(/превышает остаток бюджета/)).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Подтвердить" }).hasAttribute("disabled"),
    ).toBe(true);
  });

  it("исчерпанный бюджет гаснет, но остаётся с причиной (FR-131)", async () => {
    await atCamp(withoutArcaneRecovery(createThorne()));
    const button = screen.getByRole("button", {
      name: "Магическое восстановление · осталось 0 уровней Дневной бюджет восстановления исчерпан до следующего долгого отдыха",
    });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("без короткого отдыха восстановление недоступно, но остаток бюджета виден заранее (FR-131)", async () => {
    const user = userEvent.setup();
    await atCamp(withSpentSlots(createThorne(), 1, 1));

    const blocked = screen.getByRole("button", {
      name: "Магическое восстановление · осталось 4 уровня Берётся после короткого отдыха",
    });
    expect(blocked.hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: /Короткий отдых/ }));
    const available = screen.getByRole("button", { name: "Магическое восстановление · осталось 4 уровня" });
    expect(available.hasAttribute("disabled")).toBe(false);
  });

  it("причина недоступности видна без наведения (FR-131)", async () => {
    await atCamp(withSpentSlots(createThorne(), 1, 1));

    const blocked = screen.getByRole("button", { name: /^Магическое восстановление/ });
    expect(within(blocked).getByText("Берётся после короткого отдыха")).toBeDefined();
    expect(blocked.hasAttribute("title")).toBe(false);
    expect(blocked.querySelector("[title]")).toBeNull();
  });

  it("частичное восстановление уменьшает остаток бюджета в подписи кнопки (FR-131)", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Короткий отдых/ }));
    await user.click(screen.getByRole("button", { name: /Магическое восстановление/ }));
    await user.click(screen.getByRole("button", { name: "Вернуть ячейку 1 уровня" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(shown(stores).recovery.arcaneRecovery.remaining).toBe(3);
    expect(
      screen.getByRole("button", { name: "Магическое восстановление · осталось 3 уровня" }),
    ).toBeDefined();
  });

  it("часу нечего сделать — «Прошёл час» не предлагается (FR-002)", async () => {
    await atCamp();
    expect(screen.queryByRole("button", { name: /Прошёл час/ })).toBeNull();
  });

    it("только снижение максимума — называет только его", async () => {
      const reduced = withBloodPaid(createThorne(), 2);
      await renderWithStores(<RestScreen />, reduced);

      expect(screen.getByRole("button", { name: "Прошёл час · максимум +3" })).toBeDefined();
    });

    it("одна регенерация тоже называется: кнопка обещает всё, что случится", async () => {
      const wounded = withDamage(createThorne(), 40);
      await renderWithStores(<RestScreen />, wounded);

      expect(screen.getByRole("button", { name: "Прошёл час · регенерация +10" })).toBeDefined();
    });

    it("снижение и регенерация вместе — называет оба факта", async () => {
      const both = withDamage(withBloodPaid(createThorne(), 2), 31);
      await renderWithStores(<RestScreen />, both);

      expect(
        screen.getByRole("button", { name: "Прошёл час · максимум +3, регенерация +7" }),
      ).toBeDefined();
    });
});
