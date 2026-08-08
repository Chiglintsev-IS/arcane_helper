// @vitest-environment jsdom

/**
 * Обмен хитов на очки проверяется через экран боя целиком: от строки списка до подтверждения
 *
 * Главное здесь — инвариант «до подтверждения состояние не тронуто». Раньше строка списка списывала
 * 18 хитов одним тапом, и цена ошибки была выше, чем у любого заклинания.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { GameScreen } from "@/ui/screens/game/ui/GameScreen";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { renderWithStores } from "@/ui/app/testing/stores";
import { withDamage, withSpellPoints } from "@/core/infrastructure/catalog/thorne/fixtures";

async function openWizard(character: CharacterState = createThorne()) {
  const user = userEvent.setup();
  const rendered = await renderWithStores(<GameScreen />, character);
  await user.click(screen.getByRole("button", { name: /Магия крови/ }));
  return { user, ...rendered };
}

/** Торн с такими хитами: урон получен тем же правилом, что в бою. Максимум цел. */
function wounded(current: number): CharacterState {
  const thorne = createThorne();
  return withDamage(thorne, thorne.hitPoints.current - current);
}

describe("инвариант FR-022 для обмена (FR-177)", () => {
  it("до подтверждения хиты, максимум и очки не тронуты", async () => {
    const { user, stores } = await openWizard();

    // Бой не начат нарочно: начатый бой означал бы ещё и первый ход, а вместе с ним —
    // возможную регенерацию, которая исказила бы стартовые хиты этого теста. Обмену это не
    // мешает: вне боя действие не тратится, и мастер не предупреждает ни о чём.
    await user.click(screen.getByRole("button", { name: "Больше очков" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));

    const character = stores.session.getState().session?.character;
    expect(character?.hitPoints).toEqual({
      current: 60,
      maximumBase: 60,
      bloodReduction: 0,
      masterReduction: 0,
    });
    expect(character?.spellPoints.remaining).toBe(0);
    expect(stores.session.getState().session?.journal.at(-1)?.kind).not.toBe(
      "blood_exchange",
    );
  });

  it("отмена на середине ничего не оставляет", async () => {
    const { user, stores } = await openWizard();

    await user.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByLabelText("Магия крови")).toBeNull();
    expect(stores.session.getState().session?.character.hitPoints.current).toBe(
      60,
    );
  });
});

describe("подтверждение обмена (FR-170, FR-172)", () => {
  it("списывает хиты и максимум, начисляет очки и тратит действие", async () => {
    const { user, stores } = await openWizard();

    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const character = stores.session.getState().session?.character;
    // По умолчанию два очка: меньше не покупает ничего. Курс ступени 5–8 — 3 хита за очко.
    expect(character?.hitPoints).toEqual({
      current: 54,
      maximumBase: 60,
      bloodReduction: 6,
      masterReduction: 0,
    });
    expect(character?.spellPoints.remaining).toBe(2);
    expect(stores.session.getState().session?.journal.at(-1)?.actionUsed).toBe(
      "action",
    );
  });

  it("закрывает мастер после подтверждения", async () => {
    const { user } = await openWizard();

    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.queryByRole("button", { name: "Подтвердить" })).toBeNull();
  });
});

describe("выбор объёма (FR-178)", () => {
  it("называет цену в хитах и остаток после обмена", async () => {
    const { user } = await openWizard();
    // Бой не начат нарочно — см. комментарий в инварианте выше.
    const amount = screen.getByLabelText("Сколько очков создать");

    expect(within(amount).getByText("6 хитов")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Больше очков" }));
    expect(within(amount).getByText("9 хитов")).toBeDefined();
    expect(
      within(amount).getByText(/Хиты 60 → 51, максимум тоже 51/),
    ).toBeDefined();
  });

  it("создаёт запас на два заклинания одним действием", async () => {
    const { user, stores } = await openWizard();

    // Бой не начат нарочно — см. комментарий в инварианте выше.
    // 4 очка — это два заклинания первого уровня, чего четыре кнопки панели не позволяли.
    await user.click(screen.getByRole("button", { name: "Больше очков" }));
    await user.click(screen.getByRole("button", { name: "Больше очков" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(
      stores.session.getState().session?.character.spellPoints.remaining,
    ).toBe(4);
  });

  it("подсказывает, на что хватит, с учётом уже имеющихся очков", async () => {
    const saved = withSpellPoints(createThorne(), 3);
    await openWizard(saved);
    // Бой не начат нарочно — см. комментарий в инварианте выше.

    // 3 своих плюс 2 созданных — это пятое очко, то есть уже третий уровень.
    const amount = screen.getByLabelText("Сколько очков создать");
    expect(
      within(amount).getByText(/Станет 5 очков — хватит на 3 уровень/),
    ).toBeDefined();
  });

  it("потолок счётчика — сколько хитов есть", async () => {
    const { user } = await openWizard(wounded(7));

    // Бой не начат нарочно: у этого персонажа хиты уже занижены для теста, и «Начать
    // бой» означал бы ещё и первый ход — а с ним, возможно, регенерацию, которая испортила бы
    // подготовленное число.
    await user.click(screen.getByRole("button", { name: "Больше очков" }));
    const more = screen.getByRole("button", { name: "Больше очков" });
    expect(more.hasAttribute("disabled")).toBe(true);
    expect(
      within(screen.getByLabelText("Сколько очков создать")).getByText(
        "6 хитов",
      ),
    ).toBeDefined();
  });

  it("ниже одного очка счётчик не опускается", async () => {
    const { user } = await openWizard();

    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Меньше очков" }));
    expect(
      screen
        .getByRole("button", { name: "Меньше очков" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      within(screen.getByLabelText("Сколько очков создать")).getByText(
        "3 хита",
      ),
    ).toBeDefined();
  });
});

describe("предупреждения (FR-031, FR-175, FR-176)", () => {
  it("обмен в ноль предупреждает о ранах, но не запрещает", async () => {
    const { user, stores } = await openWizard(wounded(6));

    // Бой не начат нарочно: хиты занижены для этого теста, и «Начать бой» рисковал бы
    // их регенерацией — см. комментарий в «потолок счётчика» выше.
    await user.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText(/Хиты уйдут в ноль/)).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Подтвердить" }));
    expect(stores.session.getState().session?.character.hitPoints.current).toBe(
      0,
    );
  });

  it("подавление солнцем названо причиной и проходится «Применить всё равно»", async () => {
    const sunlit = {
      ...createThorne(),
      suppression: { firedUpon: false, underDirectSunlight: true },
    };
    const { user, stores } = await openWizard(sunlit);

    expect(
      screen.getByText(/не действует под прямым солнечным светом/),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled"),
    ).toBe(true);

    await user.click(
      screen.getByRole("button", { name: "Применить всё равно" }),
    );
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(
      stores.session.getState().session?.character.spellPoints.remaining,
    ).toBe(2);
  });

  it("нехватка хитов на одно очко названа числами", async () => {
    await openWizard(wounded(2));

    expect(screen.getByText("3 хита за очко, в наличии 2")).toBeDefined();
  });
});

describe("итоговый экран (FR-032, FR-174)", () => {
  it("говорит, что сделать, и что сказать мастеру", async () => {
    const { user } = await openWizard();

    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Далее" }));

    expect(
      screen.getByText("Отметьте 6 хитов: было 60, станет 54"),
    ).toBeDefined();
    expect(
      screen.getByText("Действием обмениваю 6 хитов на 2 очка заклинаний."),
    ).toBeDefined();
  });

  it("отыгрыша у расовой особенности нет", async () => {
    const { user } = await openWizard();

    // Бой не начат нарочно — см. комментарий в инварианте выше.
    await user.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.queryByLabelText("Отыгрыш")).toBeNull();
  });
});

describe("потеря хитов обменом не считается уроном (FR-174)", () => {
  it("при активной концентрации обмен проверки не предлагает", async () => {
    const concentrating: CharacterState = {
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
    const { user, stores } = await openWizard(concentrating);

    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    // Хиты ушли, а проверки нет: своё колдовство уроном не считается.
    expect(stores.session.getState().session?.character.hitPoints.current).toBe(54);
    expect(screen.queryByText(/Проверка концентрации/)).toBeNull();
    expect(stores.session.getState().session?.character.concentration?.spellId).toBe(
      "detect-magic",
    );
  });
});
