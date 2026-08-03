// @vitest-environment jsdom

/**
 * Мастер применения проверяется целиком через экран боя: путь UC-01 от строки списка до
 * подтверждения. Ключевое здесь — инварианты, а их видно только на настоящих
 * операциях состояния.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PlayShell as PlayScreen } from "@/ui/app/PlayShell";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { deriveTurnEconomy } from "@/core/application/useCases/turn";
import { renderWithStores, spell } from "@/ui/app/testing/stores";

// Художественный текст берётся из контента, а не переписывается в тесте: реплики правятся отдельно,
// и тест не должен падать от смены формулировки.
const rayOfFrost = spell("ray-of-frost");
function firstVariant(category: "short" | "sarcastic"): string {
  const text = rayOfFrost.roleplay.completeVariants[category][0];
  if (text === undefined) throw new Error(`у «Луча холода» нет варианта «${category}»`);
  return text;
}

/**
 * Учёт хода ведётся ровно в режиме «Бой», а он же начальный, — так что помощник ничего не
 * включает. Имя оставлено: оно объясняет, зачем тесту учёт.
 */
function withTurnTracking(): CharacterState {
  return { ...createThorne() };
}

function withoutSlots(): CharacterState {
  const character = withTurnTracking();
  character.spellSlots = {
    1: { maximum: 4, remaining: 0 },
    2: { maximum: 3, remaining: 0 },
    3: { maximum: 3, remaining: 0 },
    4: { maximum: 1, remaining: 0 },
  };
  return character;
}

function concentrating(): CharacterState {
  const character = createThorne();
  character.preparedSpellIds = [...character.preparedSpellIds, "detect-magic"];
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

/**
 * Открывает мастер применения: «Начать бой», затем строка списка и «Сотворить».
 *
 * Бой начинается по умолчанию: иначе перед тем, что проверяет тест, вставал бы лишний шаг «Бой не
 * начат» — во всех сценариях этого файла применение происходит в режиме «Бой». Тесты,
 * которым нужно снять слепок состояния до открытия мастера, но после начала боя, передают свой
 * `user` и `startCombat: false`, начиная бой отдельным вызовом заранее.
 */
async function openWizard(
  name: RegExp,
  options: { user?: ReturnType<typeof userEvent.setup>; startCombat?: boolean } = {},
) {
  const user = options.user ?? userEvent.setup();
  if (options.startCombat !== false) {
    await user.click(screen.getByRole("button", { name: "Начать бой" }));
  }
  // Поиск ограничен списком: карточка концентрации в шапке названа тем же заклинанием.
  await user.click(within(screen.getByLabelText(/^Заклинания/)).getByRole("button", { name }));
  await user.click(screen.getByRole("button", { name: "Сотворить" }));
  return user;
}

describe("вход в мастер (FR-020)", () => {
  it("«Сотворить» открывает мастер применения", async () => {
    await renderWithStores(<PlayScreen />);
    await openWizard(/Луч холода/);

    expect(screen.getByRole("dialog", { name: /Применение «Луч холода»/ })).toBeDefined();
  });

  it("заговор применяется одним экраном: сотворить и подтвердить (M-03)", async () => {
    await renderWithStores(<PlayScreen />);
    await openWizard(/Луч холода/);

    expect(screen.getByText(/Шаг 1 из 1: Объявление и подтверждение/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Подтвердить" })).toBeDefined();
  });

  it("заклинание с ячейкой — за два шага", async () => {
    await renderWithStores(<PlayScreen />);
    await openWizard(/Доспехи мага/);

    expect(screen.getByText(/Шаг 1 из 2: Чем сотворить/)).toBeDefined();
  });
});

describe("инвариант FR-022: до подтверждения ресурсы не тронуты", () => {
  it("полный проход мастера и отмена оставляют состояние прежним", async () => {
    const { stores } = await renderWithStores(<PlayScreen />);
    // Бой начат заранее: снимок «до» должен отражать состояние прямо перед открытием мастера,
    // а не более раннее — иначе он не сойдётся с тем, что тест сравнивает после отмены.
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    const before = structuredClone(stores.session.getState().session);

    await openWizard(/Доспехи мага/, { user, startCombat: false });
    await user.click(screen.getByRole("button", { name: /Ячейка 3 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByRole("button", { name: "Подтвердить" })).toBeDefined();

    expect(stores.session.getState().session).toEqual(before);

    await user.click(screen.getByRole("button", { name: "Отмена" }));
    expect(stores.session.getState().session).toEqual(before);
  });
});

describe("подтверждение (FR-023, AC-11)", () => {
  it("списывает выбранную ячейку, создаёт эффект и одну запись журнала", async () => {
    const { stores } = await renderWithStores(<PlayScreen />, withTurnTracking());

    const user = await openWizard(/Доспехи мага/);
    await user.click(screen.getByRole("button", { name: /Ячейка 2 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const session = stores.session.getState().session;
    expect(session?.character.spellSlots[2]?.remaining).toBe(2);
    expect(session?.character.spellSlots[1]?.remaining).toBe(4);
    expect(session?.character.activeEffects).toHaveLength(1);
    // Две записи: «Бой начался» из `openWizard`, затем само применение.
    expect(session?.journal).toHaveLength(2);
    expect(session?.journal.at(-1)?.summaryRu).toBe("Доспехи мага — ячейкой 2 уровня");
    expect(deriveTurnEconomy(stores.session.getState().session!).actionAvailable).toBe(false);
  });

  it("после подтверждения мастер закрывается", async () => {
    await renderWithStores(<PlayScreen />);

    const user = await openWizard(/Луч холода/);
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("объявление мастеру (FR-041, AC-12)", () => {
  it("называет выбранный уровень ячейки и цель", async () => {
    // «Молния»: выбор ячейки есть, концентрации нет — значит шага замены между ними не встанет,
    // а в объявлении стоят и уровень ячейки, и КС спасброска.
    await renderWithStores(<PlayScreen />);

    const user = await openWizard(/^Молния/);
    await user.click(screen.getByRole("button", { name: /Ячейка 3 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Далее" }));

    const announcement = screen.getByLabelText("Объявление мастеру");
    expect(within(announcement).getByText(/ячейкой 3 уровня/)).toBeDefined();
    expect(within(announcement).getByText(/против КС 16/)).toBeDefined();
  });

  it("показывает урон по выбранному уровню ячейки до подтверждения (FR-071)", async () => {
    await renderWithStores(<PlayScreen />);
    const user = await openWizard(/Поглощение стихий/);

    expect(screen.getByRole("button", { name: /Ячейка 1 уровня/ })).toBeDefined();
    expect(within(screen.getByRole("button", { name: /Ячейка 3 уровня/ })).getByText(/3d6/)).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Ячейка 3 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText(/добавит 3d6/)).toBeDefined();
  });

  it("механика и отыгрыш живут в разных блоках (AC-20)", async () => {
    await renderWithStores(<PlayScreen />);
    const user = await openWizard(/Луч холода/);

    const mechanics = screen.getByLabelText("Объявление мастеру");
    const roleplay = screen.getByLabelText("Отыгрыш");
    expect(mechanics.contains(roleplay)).toBe(false);
    expect(within(roleplay).getByText(firstVariant("short"))).toBeDefined();

    await user.click(within(roleplay).getByRole("button", { name: "Саркастично" }));
    expect(within(roleplay).getByText(firstVariant("sarcastic"))).toBeDefined();
  });
});

describe("предупреждение вместо запрета (FR-031)", () => {
  it("без свободных ячеек показывает причину и не пускает дальше без разрешения", async () => {
    await renderWithStores(<PlayScreen />, withoutSlots());
    const user = await openWizard(/Доспехи мага/);

    expect(screen.getByText("Нет свободной ячейки 1 уровня")).toBeDefined();
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(false);
  });

  it("«Применить всё равно» доводит применение до конца и показывает долг ячейки", async () => {
    const { stores } = await renderWithStores(<PlayScreen />, withoutSlots());
    const user = await openWizard(/Доспехи мага/);

    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(stores.session.getState().session?.character.spellSlots[1]?.remaining).toBe(-1);
  });
});

describe("замена концентрации (FR-081, AC-13)", () => {
  it("требует выбора из двух вариантов, а не «всё равно»", async () => {
    await renderWithStores(<PlayScreen />, concentrating());
    const user = await openWizard(/^Обнаружение магии/);

    expect(screen.getByText(/Шаг 1 из 3: Чем сотворить/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Далее" }));

    expect(screen.getByText(/Идёт концентрация: «Обнаружение магии»/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Заменить концентрацию" }));
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(false);
  });

  it("после замены остаётся ровно одна концентрация (FR-080)", async () => {
    const { stores } = await renderWithStores(<PlayScreen />, concentrating());
    const user = await openWizard(/^Обнаружение магии/);

    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Заменить концентрацию" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const character = stores.session.getState().session?.character;
    expect(character?.activeEffects.filter((effect) => effect.isConcentration)).toHaveLength(1);
    expect(character?.concentration?.spellId).toBe("detect-magic");
  });

  it("отмена на шаге концентрации оставляет прежний эффект", async () => {
    const { stores } = await renderWithStores(<PlayScreen />, concentrating());
    // Бой начат заранее — по той же причине, что и в тесте выше.
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Начать бой" }));
    const before = structuredClone(stores.session.getState().session);
    await openWizard(/^Обнаружение магии/, { user, startCombat: false });

    await user.click(screen.getByRole("button", { name: "Далее" }));
    // На шаге концентрации две кнопки: «Отмена» рядом с «Заменить концентрацию».
    const step = screen.getByRole("dialog", { name: /Применение/ });
    await user.click(within(step).getAllByRole("button", { name: "Отмена" })[1]!);

    expect(stores.session.getState().session).toEqual(before);
    // Мастер закрыт; открытой остаётся карточка заклинания, из которой пришли.
    expect(screen.queryByRole("dialog", { name: /Применение/ })).toBeNull();
  });
});

describe("шаг компонентов", () => {
  it("появляется для компонента со стоимостью и объясняет, что фокусировка его не заменяет", async () => {
    // «Опознание» творится минуту, поэтому в режиме «Бой» его нет: берём книгу.
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />);
    await user.click(screen.getByRole("radio", { name: /Книга/ }));

    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /^Опознание/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    // Чем сотворить → компоненты → объявление: жемчужина требует отдельного шага.
    await user.click(screen.getByRole("button", { name: "Далее" }));

    expect(screen.getByText(/Шаг 2 из 3: Компоненты/)).toBeDefined();
    expect(screen.getByText(/фокусировка не заменяет/)).toBeDefined();
  });
});

describe("обязательность в блоке отыгрыша (ADR-0011)", () => {
  it("подсвечивает, что вербальное заклинание нужно произнести вслух", async () => {
    await renderWithStores(<PlayScreen />);
    await openWizard(/Луч холода/);

    const roleplay = screen.getByLabelText("Отыгрыш");
    expect(
      within(roleplay).getByText("Обязательно: произнести вслух и сделать жест свободной рукой"),
    ).toBeDefined();
  });

  it("не просит цель и не показывает её отсутствие как пробел (OQ-10)", async () => {
    await renderWithStores(<PlayScreen />);
    await openWizard(/Луч холода/);

    expect(screen.queryByLabelText("Цель или точка")).toBeNull();
    expect(screen.queryByText("Цель не указана")).toBeNull();
  });
})

describe("недоступность руны названа причиной (FR-151, OQ-17)", () => {
  it("при оплате кровью руна не применяется и говорит почему", async () => {
    const user = userEvent.setup();
    const rich = withTurnTracking();
    rich.spellPoints = { remaining: 6 };
    await renderWithStores(<PlayScreen />, rich);
    await openWizard(/^Паутина/);

    await user.click(screen.getByRole("button", { name: /^Кровью/ }));

    const rune = screen.getByLabelText("Руна");
    expect(within(rune).getByText("При оплате кровью руна не применяется")).toBeDefined();
    expect(within(rune).queryByRole("button")).toBeNull();
  });

  it("без рун объясняет, когда они вернутся", async () => {
    const spent = withTurnTracking();
    spent.runes = { maximum: 3, remaining: 0 };
    await renderWithStores(<PlayScreen />, spent);
    await openWizard(/^Паутина/);

    const rune = screen.getByLabelText("Руна");
    expect(within(rune).getByText("Рун не осталось, вернутся долгим отдыхом")).toBeDefined();
  });

  it("у заговора блока руны нет вовсе: ячейку он не тратит", async () => {
    await renderWithStores(<PlayScreen />);
    await openWizard(/Луч холода/);

    expect(screen.queryByLabelText("Руна")).toBeNull();
  });
});

describe("руна жизни спрашивает кому (FR-156)", () => {
  it("выбор цели появляется у жизни и не появляется у остальных", async () => {
    const user = userEvent.setup();
    await renderWithStores(<PlayScreen />, withTurnTracking());
    await openWizard(/^Паутина/);

    expect(screen.queryByRole("group", { name: "Кому руна" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Руна жизни/ }));
    const target = screen.getByRole("group", { name: "Кому руна" });
    expect(within(target).getByRole("button", { name: "Себе" })).toBeDefined();
    expect(within(target).getByRole("button", { name: "Другому" })).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Руна ветра/ }));
    expect(screen.queryByRole("group", { name: "Кому руна" })).toBeNull();
  });

  it("выбранный другой оставляет временные хиты нетронутыми (FR-156)", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<PlayScreen />, withTurnTracking());
    await openWizard(/^Паутина/);

    await user.click(screen.getByRole("button", { name: /Руна жизни/ }));
    await user.click(screen.getByRole("button", { name: "Другому" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const after = stores.session.getState().session?.character;
    expect(after?.temporaryHitPoints).toBe(0);
    expect(after?.runes.remaining).toBe(2);
  });
});

describe("шаг костей хитов (FR-135)", () => {
  /**
   * Раненый Торн с подготовленной «Мистической бодростью».
   *
   * Ранение — чтобы лечение не упёрлось в максимум. Подготовка — потому что в боевом списке только
   * заговоры и подготовленное, а в книге Торна это заклинание по умолчанию не подготовлено.
   */
  function woundedThorne(): CharacterState {
    const character = withTurnTracking();
    character.hitPoints.current = 30;
    character.preparedSpellIds = [...character.preparedSpellIds, "arcane-vigor"];
    return character;
  }

  /** До костей мастер проходит через выбор ячейки: он идёт первым и от него зависит максимум. */
  async function openHitDiceStep() {
    const user = await openWizard(/Мистическая бодрость/);
    await user.click(screen.getByRole("button", { name: "Далее" }));
    return user;
  }

  it("шаг есть у заклинания с расходом костей", async () => {
    await renderWithStores(<PlayScreen />, woundedThorne());
    await openHitDiceStep();
    expect(screen.getByText("Сколько костей бросить")).toBeTruthy();
  });

  it("шага нет у заклинания без расхода", async () => {
    await renderWithStores(<PlayScreen />, woundedThorne());
    await openWizard(/Молния/);
    expect(screen.queryByText("Сколько костей бросить")).toBeNull();
  });

  it("ячейка 2 уровня даёт выбрать до двух костей", async () => {
    await renderWithStores(<PlayScreen />, woundedThorne());
    await openHitDiceStep();
    expect(screen.getByRole("button", { name: "1d6" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2d6" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "3d6" })).toBeNull();
  });

  it("без выбранного числа костей дальше не пускает", async () => {
    await renderWithStores(<PlayScreen />, woundedThorne());
    await openHitDiceStep();
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(true);
  });

  it("выпавшее вне возможного отвергается с причиной", async () => {
    await renderWithStores(<PlayScreen />, woundedThorne());
    const user = await openHitDiceStep();
    await user.click(screen.getByRole("button", { name: "2d6" }));
    await user.type(screen.getByLabelText("Что выпало на 2d6"), "13");
    expect(screen.getByText("На 2d6 может выпасть от 2 до 12")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(true);
  });

  it("возможное выпавшее показывает итог с модификатором", async () => {
    await renderWithStores(<PlayScreen />, woundedThorne());
    const user = await openHitDiceStep();
    await user.click(screen.getByRole("button", { name: "2d6" }));
    await user.type(screen.getByLabelText("Что выпало на 2d6"), "9");
    expect(screen.getByText("9 + 4 — вернётся 13 хитов")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(false);
  });

  it("подтверждение списывает кости и лечит", async () => {
    const { stores } = await renderWithStores(<PlayScreen />, woundedThorne());
    const user = await openHitDiceStep();
    await user.click(screen.getByRole("button", { name: "2d6" }));
    await user.type(screen.getByLabelText("Что выпало на 2d6"), "9");
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const after = stores.session.getState().session?.character;
    expect(after?.hitDice?.remaining).toBe(5);
    expect(after?.hitPoints.current).toBe(43);
  });

  it("без костей шаг объясняет, а не прячется", async () => {
    const spent = woundedThorne();
    spent.hitDice = { total: 7, size: 6, remaining: 0 };
    await renderWithStores(<PlayScreen />, spent);
    await openHitDiceStep();
    expect(screen.getByText(/бросать нечего/)).toBeTruthy();
    // Предупреждение, а не запрет: ячейку игрок вправе потратить впустую.
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(false);
  });
});
