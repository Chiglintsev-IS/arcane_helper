// @vitest-environment jsdom

/**
 * Обмен хитов на очки проверяется через экран боя целиком: от строки списка до подтверждения
 *
 * Главное здесь — инвариант «до подтверждения состояние не тронуто». Раньше строка списка списывала
 * 18 хитов одним тапом, и цена ошибки была выше, чем у любого заклинания.
 */

import type { TurnEconomy } from "@/core/application/useCases/turn";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { exchangeWarnings } from "@/ui/widgets/blood-magic-wizard/ui/BloodMagicWizard";
import { CombatScreen } from "@/ui/screens/combat/ui/CombatScreen";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/character/state";
import { renderWithStores } from "@/ui/app/testing/stores";

/** Экономия хода «всё цело»: тесты обмена интересуются не ходом, а хитами и очками. */
const ALL_AVAILABLE_ECONOMY: TurnEconomy = {
  round: 1,
  started: true,
  inFight: true,
  tracksTurn: true,
  actionAvailable: true,
  bonusActionAvailable: true,
  reactionAvailable: true,
  reactionReturns: null,
};

async function openWizard(character: CharacterState = createThorne()) {
  const user = userEvent.setup();
  const rendered = await renderWithStores(<CombatScreen />, character);
  await user.click(screen.getByRole("button", { name: /Магия крови/ }));
  return { user, ...rendered };
}

function hitPoints(current: number): Partial<CharacterState> {
  return { hitPoints: { current, maximum: 60, maximumReduction: 0 } };
}

describe("инвариант FR-022 для обмена (FR-177)", () => {
  it("до подтверждения хиты, максимум и очки не тронуты", async () => {
    const { user, stores } = await openWizard();

    // Бой не начат нарочно: начатый бой означал бы ещё и первый ход, а вместе с ним —
    // возможную регенерацию, которая исказила бы стартовые хиты этого теста. Причину проходим
    // «Применить всё равно», не трогая состояние боя.
    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Больше очков" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));

    const character = stores.session.getState().session?.character;
    expect(character?.hitPoints).toEqual({ current: 60, maximum: 60, maximumReduction: 0 });
    expect(character?.spellPoints.remaining).toBe(0);
    expect(stores.session.getState().session?.journal.at(-1)?.kind).not.toBe("blood_exchange");
  });

  it("отмена на середине ничего не оставляет", async () => {
    const { user, stores } = await openWizard();

    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByLabelText("Магия крови")).toBeNull();
    expect(stores.session.getState().session?.character.hitPoints.current).toBe(60);
  });
});

describe("подтверждение обмена (FR-170, FR-172)", () => {
  it("списывает хиты и максимум, начисляет очки и тратит действие", async () => {
    const { user, stores } = await openWizard();

    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const character = stores.session.getState().session?.character;
    // По умолчанию два очка: меньше не покупает ничего. Курс ступени 5–8 — 3 хита за очко.
    expect(character?.hitPoints).toEqual({ current: 54, maximum: 54, maximumReduction: 6 });
    expect(character?.spellPoints.remaining).toBe(2);
    expect(stores.session.getState().session?.journal.at(-1)?.actionUsed).toBe("action");
  });

  it("закрывает мастер после подтверждения", async () => {
    const { user } = await openWizard();

    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.queryByRole("button", { name: "Подтвердить" })).toBeNull();
  });
});

describe("выбор объёма (FR-178)", () => {
  it("называет цену в хитах и остаток после обмена", async () => {
    const { user } = await openWizard();
    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    const amount = screen.getByLabelText("Сколько очков создать");

    expect(within(amount).getByText("6 хитов")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Больше очков" }));
    expect(within(amount).getByText("9 хитов")).toBeDefined();
    expect(within(amount).getByText(/Хиты 60 → 51, максимум тоже 51/)).toBeDefined();
  });

  it("создаёт запас на два заклинания одним действием", async () => {
    const { user, stores } = await openWizard();

    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    // 4 очка — это два заклинания первого уровня, чего четыре кнопки панели не позволяли.
    await user.click(screen.getByRole("button", { name: "Больше очков" }));
    await user.click(screen.getByRole("button", { name: "Больше очков" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(stores.session.getState().session?.character.spellPoints.remaining).toBe(4);
  });

  it("подсказывает, на что хватит, с учётом уже имеющихся очков", async () => {
    const saved = createThorne();
    saved.spellPoints = { remaining: 3, createdAt: "2026-07-31T18:00:00.000Z" };
    const { user } = await openWizard(saved);
    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));

    // 3 своих плюс 2 созданных — это пятое очко, то есть уже третий уровень.
    const amount = screen.getByLabelText("Сколько очков создать");
    expect(within(amount).getByText(/Станет 5 очков — хватит на 3 уровень/)).toBeDefined();
  });

  it("потолок счётчика — сколько хитов есть", async () => {
    const { user } = await openWizard({ ...createThorne(), ...hitPoints(7) });

    // Бой не начат нарочно: у этого персонажа хиты уже занижены для теста, и «Начать
    // бой» означал бы ещё и первый ход — а с ним, возможно, регенерацию, которая испортила бы
    // подготовленное число. Причину проходим «Применить всё равно».
    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Больше очков" }));
    const more = screen.getByRole("button", { name: "Больше очков" });
    expect(more.hasAttribute("disabled")).toBe(true);
    expect(within(screen.getByLabelText("Сколько очков создать")).getByText("6 хитов")).toBeDefined();
  });

  it("ниже одного очка счётчик не опускается", async () => {
    const { user } = await openWizard();

    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Меньше очков" }));
    expect(screen.getByRole("button", { name: "Меньше очков" }).hasAttribute("disabled")).toBe(true);
    expect(
      within(screen.getByLabelText("Сколько очков создать")).getByText("3 хита"),
    ).toBeDefined();
  });
});

describe("предупреждения (FR-031, FR-175, FR-176)", () => {
  it("обмен в ноль предупреждает о ранах, но не запрещает", async () => {
    const { user, stores } = await openWizard({ ...createThorne(), ...hitPoints(6) });

    // Бой не начат нарочно: хиты занижены для этого теста, и «Начать бой» рисковал бы
    // их регенерацией — см. комментарий в «потолок счётчика» выше.
    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText(/Хиты уйдут в ноль/)).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(stores.session.getState().session?.character.hitPoints.current).toBe(0);
  });

  it("подавление солнцем названо причиной и проходится «Применить всё равно»", async () => {
    const sunlit = createThorne();
    sunlit.suppression = { firedUpon: false, underDirectSunlight: true };
    const { user, stores } = await openWizard(sunlit);

    expect(screen.getByText(/не действует под прямым солнечным светом/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(stores.session.getState().session?.character.spellPoints.remaining).toBe(2);
  });

  it("нехватка хитов на одно очко названа числами", async () => {
    await openWizard({ ...createThorne(), ...hitPoints(2) });

    expect(screen.getByText("3 хита за очко, в наличии 2")).toBeDefined();
  });
});

describe("итоговый экран (FR-032, FR-174)", () => {
  it("говорит, что сделать, и что сказать мастеру", async () => {
    const { user } = await openWizard();

    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));

    expect(screen.getByText("Отметьте 6 хитов: было 60, станет 54")).toBeDefined();
    expect(screen.getByText("Действием обмениваю 6 хитов на 2 очка заклинаний.")).toBeDefined();
  });

  it("отыгрыша у расовой особенности нет", async () => {
    const { user } = await openWizard();

    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.queryByLabelText("Отыгрыш")).toBeNull();
  });
});

describe("обмен до начала боя (FR-034)", () => {
  it("называет ту же причину, что и заклинание: обмен тратит то же действие", () => {
    const economy = { ...ALL_AVAILABLE_ECONOMY, inFight: false };
    expect(exchangeWarnings(createThorne(), economy)).toContain(
      "Бой не начат — сначала «Начать бой»",
    );
  });

  it("после начала боя причины нет", () => {
    const economy = { ...ALL_AVAILABLE_ECONOMY, inFight: true };
    expect(exchangeWarnings(createThorne(), economy)).not.toContain(
      "Бой не начат — сначала «Начать бой»",
    );
  });
});
