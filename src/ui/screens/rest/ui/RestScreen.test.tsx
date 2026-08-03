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
import { renderWithStores } from "@/ui/app/testing/stores";
import { RestScreen } from "@/ui/screens/rest/ui/RestScreen";

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

describe("шторки «Привала» (FR-205, FR-237)", () => {
  it("плитка КД открывает правку поправки и доводит её до итога", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RestScreen />);

    await user.click(screen.getByRole("button", { name: /^КД 14/ }));
    const sheet = screen.getByRole("dialog", { name: "Правка КД" });
    await user.type(within(sheet).getByLabelText("Поправка"), "2");
    await user.click(within(sheet).getByRole("button", { name: "Записать" }));

    expect(screen.queryByRole("dialog", { name: "Правка КД" })).toBeNull();
    expect(screen.getByRole("button", { name: /^КД 16/ })).toBeDefined();
  });

  it("плитка хитов открывает правку урона и списывает хиты", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RestScreen />);

    await user.click(screen.getByRole("button", { name: /^Хиты/ }));
    await user.type(screen.getByLabelText("Полученный урон"), "12");
    await user.click(screen.getByRole("button", { name: "Записать" }));

    expect(screen.getByText("48/60")).toBeDefined();
  });

  it("плитка ячейки открывает ручную правку ресурсов", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RestScreen />);

    await user.click(screen.getByRole("button", { name: /^Ячейки 1 уровня/ }));
    const sheet = screen.getByRole("dialog", { name: "Правка ресурсов" });
    await user.click(within(sheet).getByRole("button", { name: "Потратить: Ячейка 1 ур." }));

    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(3);
  });

  it("карточка концентрации открывает лист и снимает концентрацию", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RestScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /Концентрация: Обнаружение магии/ }));
    const panel = screen.getByRole("dialog", { name: "Концентрация: Обнаружение магии" });
    await user.click(within(panel).getByRole("button", { name: "Снять концентрацию" }));

    expect(stores.session.getState().session?.character.concentration).toBeUndefined();
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
    await user.click(screen.getByRole("button", { name: "Записать" }));

    const check = screen.getByRole("dialog", { name: "Проверка концентрации" });
    expect(within(check).getByText(/КС 12/)).toBeDefined();
  });

  it("провал проверки снимает концентрацию с привала так же, как из боя", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RestScreen />, concentrating());

    await user.click(screen.getByRole("button", { name: /^Хиты/ }));
    await user.type(screen.getByLabelText("Полученный урон"), "24");
    await user.click(screen.getByRole("button", { name: "Записать" }));
    // Руна и реакция на месте, поэтому провал сначала предлагает «Знаки ограждения».
    await user.click(screen.getByRole("button", { name: "Провал" }));
    await user.click(screen.getByRole("button", { name: "Всё равно провал" }));

    expect(stores.session.getState().session?.character.concentration).toBeUndefined();
    expect(screen.queryByRole("dialog", { name: "Проверка концентрации" })).toBeNull();
  });
});

describe("режим «Привал» и операции отдыха (FR-215, FR-237)", () => {
  /** Торн на привале, потративший ячейку первого уровня: восстанавливать есть что. */
  async function atCamp(character: CharacterState = createThorne()) {
    const spent = {
      ...character,
      spellSlots: { ...character.spellSlots, 1: { maximum: 4, remaining: 2 } },
    };
    return renderWithStores(<RestScreen />, spent);
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

    // Короткий отдых — предусловие правила: до него восстановление недоступно. Экран остаётся
    // «Привалом» после отдыха — закрывать здесь нечего.
    await user.click(screen.getByRole("button", { name: /Короткий отдых/ }));
    await user.click(screen.getByRole("button", { name: /Магическое восстановление/ }));
    await user.click(screen.getByRole("button", { name: "Вернуть ячейку 1 уровня" }));
    await user.click(screen.getByRole("button", { name: "Вернуть ячейки" }));

    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(3);
    expect(stores.session.getState().session?.character.arcaneRecovery.remaining).toBe(3);
  });

  it("исчерпанный бюджет гаснет, но остаётся с причиной (FR-131)", async () => {
    // Раньше кнопка исчезала. Пропавшая кнопка не отвечает на вопрос «почему нельзя», а за столом
    // он возникает раньше, чем игрок вспомнит правило, — требование это изменило.
    await atCamp({ ...createThorne(), arcaneRecovery: { maximum: 4, remaining: 0 } });
    const button = screen.getByRole("button", {
      name: "Магическое восстановление · осталось 0 уровней — Дневной бюджет восстановления исчерпан до следующего долгого отдыха",
    });
    expect(button.hasAttribute("disabled")).toBe(true);
  });

  it("без короткого отдыха восстановление недоступно, но остаток бюджета виден заранее (FR-131)", async () => {
    const user = userEvent.setup();
    const spent = createThorne();
    spent.spellSlots[1] = { maximum: 4, remaining: 3 };
    await atCamp(spent);

    // Причина названа словами на самой кнопке, и лечится она соседней — в том же ряду. Остаток
    // бюджета виден в подписи ещё до того, как отдых его открыл.
    const blocked = screen.getByRole("button", {
      name: "Магическое восстановление · осталось 4 уровня — Берётся после короткого отдыха",
    });
    expect(blocked.hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: /Короткий отдых/ }));
    const available = screen.getByRole("button", { name: "Магическое восстановление · осталось 4 уровня" });
    expect(available.hasAttribute("disabled")).toBe(false);
  });

  it("частичное восстановление уменьшает остаток бюджета в подписи кнопки (FR-131)", async () => {
    const user = userEvent.setup();
    const { stores } = await atCamp();

    await user.click(screen.getByRole("button", { name: /Короткий отдых/ }));
    await user.click(screen.getByRole("button", { name: /Магическое восстановление/ }));
    await user.click(screen.getByRole("button", { name: "Вернуть ячейку 1 уровня" }));
    await user.click(screen.getByRole("button", { name: "Вернуть ячейки" }));
    expect(stores.session.getState().session?.character.arcaneRecovery.remaining).toBe(3);
    expect(
      screen.getByRole("button", { name: "Магическое восстановление · осталось 3 уровня" }),
    ).toBeDefined();
  });

  it("часу нечего сделать — «Прошёл час» не предлагается (FR-002)", async () => {
    await atCamp();
    expect(screen.queryByRole("button", { name: /Прошёл час/ })).toBeNull();
  });

    it("только снижение максимума — называет только его", async () => {
      const reduced = createThorne();
      reduced.hitPoints = { current: 51, maximumBase: 60, bloodReduction: 9, masterReduction: 0 };
      await renderWithStores(<RestScreen />, reduced);

      expect(screen.getByRole("button", { name: "Прошёл час · максимум +3" })).toBeDefined();
    });

    it("только непогашенные очки — называет их числом, а не намёком", async () => {
      const withPoints = createThorne();
      withPoints.spellPoints = { remaining: 5 };
      await renderWithStores(<RestScreen />, withPoints);

      expect(screen.getByRole("button", { name: "Прошёл час · сгорит 5 очков" })).toBeDefined();
    });

    it("снижение и очки вместе — называет оба факта", async () => {
      const both = createThorne();
      both.hitPoints = { current: 51, maximumBase: 60, bloodReduction: 9, masterReduction: 0 };
      both.spellPoints = { remaining: 1 };
      await renderWithStores(<RestScreen />, both);

      expect(screen.getByRole("button", { name: "Прошёл час · максимум +3, сгорит 1 очко" })).toBeDefined();
    });



});
