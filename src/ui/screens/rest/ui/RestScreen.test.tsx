// @vitest-environment jsdom

/**
 * «Привал» на настоящем состоянии и настоящих операциях: моков нет.
 *
 * Экран проверяется сам по себе, без оболочки: шторки принадлежат ему, и открывать их обязан он, а
 * не общий слой поверх приложения.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { renderWithStores, shown, slotsLeft } from "@/ui/app/testing/stores";
import { RestScreen } from "@/ui/screens/rest/ui/RestScreen";
import { withBloodExchange, withSpellPointsSpent } from "@/core/infrastructure/catalog/thorne/fixtures";
import {
  withBloodSpent,
  withDamage,
  withSpellPoints,
  withSpentSlots,
  withoutArcaneRecovery,
} from "@/core/infrastructure/catalog/thorne/fixtures";

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

  it("карточка концентрации открывает лист и снимает концентрацию", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RestScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ }));
    const panel = screen.getByRole("dialog", { name: "Концентрация: Обнаружение магии" });
    await user.click(within(panel).getByRole("button", { name: "Снять концентрацию" }));

    expect(shown(stores).concentration).toBeUndefined();
  });

  it("перехода к полным правилам на «Привале» нет: подробная карточка живёт в других режимах", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RestScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ }));

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
    // Руна и реакция на месте, поэтому провал сначала предлагает «Знаки ограждения».
    await user.click(screen.getByRole("button", { name: "Провал" }));
    await user.click(screen.getByRole("button", { name: "Всё равно провал" }));

    expect(shown(stores).concentration).toBeUndefined();
    expect(screen.queryByRole("dialog", { name: /^Проверка концентрации/ })).toBeNull();
  });
});

describe("режим «Привал» и операции отдыха (FR-215, FR-237)", () => {
  /** Торн на привале, потративший ячейку первого уровня: восстанавливать есть что. */
  async function atCamp(character: CharacterState = createThorne()) {
    return renderWithStores(<RestScreen />, withSpentSlots(character, 1, 2));
  }
  it("показывает ресурсы и активные эффекты, но не список заклинаний (FR-237)", async () => {
    await atCamp(concentrating());

    expect(screen.getByLabelText("Ресурсы")).toBeDefined();
    // Концентрация — часть блока действующего: она обязана быть видна на «Привале» так же, как
    // и на «Игре», ведь долгий отдых её снимает.
    expect(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ })).toBeDefined();
    expect(screen.queryByLabelText(/^Заклинания/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Реакции" })).toBeNull();
    expect(screen.queryByLabelText(/^Подготовлено/)).toBeNull();
    expect(screen.queryByRole("button", { name: /^(Начать бой|Окончить бой|Новый ход)/ })).toBeNull();
  });

  it("короткий отдых доступен кнопкой и пишется в журнал", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Короткий отдых/ }));

    expect(shown(stores).journal.at(-1)?.kind).toBe("short_rest");
  });

  it("долгий отдых требует подтверждения и возвращает ячейки (FR-133)", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Долгий отдых/ }));
    // Случайное нажатие уничтожает состояние боя, поэтому между кнопкой и отдыхом стоит выбор.
    expect(slotsLeft(stores, 1)).toBe(2);

    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(slotsLeft(stores, 1)).toBe(4);
  });

  it("отмена подтверждения ничего не меняет", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Долгий отдых/ }));
    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(shown(stores).journal).toHaveLength(0);
    expect(slotsLeft(stores, 1)).toBe(2);
  });

  it("магическое восстановление возвращает выбранные ячейки (FR-131)", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    // Короткий отдых — предусловие правила: до него восстановление недоступно. Экран остаётся
    // «Привалом» после отдыха — закрывать здесь нечего.
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
    // Бюджет Торна — четыре уровня: ячейка четвёртого укладывается, ячейка сверх неё — уже нет.
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
    // Раньше кнопка исчезала. Пропавшая кнопка не отвечает на вопрос «почему нельзя», а за столом
    // он возникает раньше, чем игрок вспомнит правило, — требование это изменило.
    await atCamp(withoutArcaneRecovery(createThorne()));
    const button = screen.getByRole("button", {
      name: "Магическое восстановление · осталось 0 уровней Дневной бюджет восстановления исчерпан до следующего долгого отдыха",
    });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("без короткого отдыха восстановление недоступно, но остаток бюджета виден заранее (FR-131)", async () => {
    const user = userEvent.setup();
    await atCamp(withSpentSlots(createThorne(), 1, 1));

    // Причина названа словами на самой кнопке, и лечится она соседней — в том же ряду. Остаток
    // бюджета виден в подписи ещё до того, как отдых его открыл.
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

    // Причина стоит строкой внутри кнопки. Всплывающая подсказка её не заменяет: за столом наводить
    // нечем, и причина, доступная только курсору, не показана вовсе.
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
      // Три очка кровью уже израсходованы: час вернёт только максимум.
      const reduced = withBloodSpent(createThorne(), 3);
      await renderWithStores(<RestScreen />, reduced);

      expect(screen.getByRole("button", { name: "Прошёл час · максимум +3" })).toBeDefined();
    });

    it("только непогашенные очки — называет их числом, а не намёком", async () => {
      const withPoints = withSpellPoints(createThorne(), 5);
      await renderWithStores(<RestScreen />, withPoints);

      expect(screen.getByRole("button", { name: "Прошёл час · сгорит 5 очков" })).toBeDefined();
    });

    it("одна регенерация тоже называется: кнопка обещает всё, что случится", async () => {
      // Хиты ниже половины и максимум цел: возвращать нечего, а час доводит регенерацией до
      // половины — с 20 до 30.
      const wounded = withDamage(createThorne(), 40);
      await renderWithStores(<RestScreen />, wounded);

      expect(screen.getByRole("button", { name: "Прошёл час · регенерация +10" })).toBeDefined();
    });

    it("снижение и очки вместе — называет оба факта", async () => {
      // Три очка созданы кровью, два из них ушли на заклинание первого уровня.
      const both = {
        ...withSpellPointsSpent(withBloodExchange(createThorne(), 3), 1),
      };
      await renderWithStores(<RestScreen />, both);

      expect(screen.getByRole("button", { name: "Прошёл час · максимум +3, сгорит 1 очко" })).toBeDefined();
    });



});
