// @vitest-environment jsdom

/**
 * Мастер применения проверяется целиком через экран боя: путь UC-01 от строки списка до
 * подтверждения. Ключевое здесь — инварианты FR-022 и FR-023, а их видно только на настоящих
 * операциях состояния.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CombatScreen } from "@/components/combat/CombatScreen";
import { createThorne } from "@/data/content/thorne/character";
import type { CharacterState } from "@/data/schemas/character";
import { renderWithStores, spell } from "@/testing/stores";

// Художественный текст берётся из контента, а не переписывается в тесте: реплики правятся отдельно,
// и тест не должен падать от смены формулировки.
const rayOfFrost = spell("ray-of-frost");
function firstVariant(category: "short" | "sarcastic"): string {
  const text = rayOfFrost.roleplay.completeVariants[category][0];
  if (text === undefined) throw new Error(`у «Луча холода» нет варианта «${category}»`);
  return text;
}

/**
 * Учёт хода ведётся ровно в режиме «Бой» (FR-143), а он же начальный, — так что помощник ничего не
 * включает. Имя оставлено: оно объясняет, зачем тесту учёт.
 */
function withTurnTracking(): CharacterState {
  return { ...createThorne(), screenMode: "combat" };
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

async function openWizard(name: RegExp) {
  const user = userEvent.setup();
  // Поиск ограничен списком: карточка концентрации в шапке названа тем же заклинанием (FR-084).
  await user.click(within(screen.getByLabelText("Заклинания")).getByRole("button", { name }));
  await user.click(screen.getByRole("button", { name: "Сотворить" }));
  return user;
}

describe("вход в мастер (FR-020)", () => {
  it("«Сотворить» открывает мастер применения", async () => {
    await renderWithStores(<CombatScreen />);
    await openWizard(/Луч холода/);

    expect(screen.getByRole("dialog", { name: /Применение «Луч холода»/ })).toBeDefined();
  });

  it("заговор применяется одним экраном: сотворить и подтвердить (M-03)", async () => {
    await renderWithStores(<CombatScreen />);
    await openWizard(/Луч холода/);

    expect(screen.getByText(/Шаг 1 из 1: Объявление и подтверждение/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Подтвердить" })).toBeDefined();
  });

  it("заклинание с ячейкой — за два шага", async () => {
    await renderWithStores(<CombatScreen />);
    await openWizard(/Доспехи мага/);

    expect(screen.getByText(/Шаг 1 из 2: Чем сотворить/)).toBeDefined();
  });
});

describe("инвариант FR-022: до подтверждения ресурсы не тронуты", () => {
  it("полный проход мастера и отмена оставляют состояние прежним", async () => {
    const { stores } = await renderWithStores(<CombatScreen />);
    const before = structuredClone(stores.session.getState().session);

    const user = await openWizard(/Доспехи мага/);
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
    const { stores } = await renderWithStores(<CombatScreen />, withTurnTracking());

    const user = await openWizard(/Доспехи мага/);
    await user.click(screen.getByRole("button", { name: /Ячейка 2 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const session = stores.session.getState().session;
    expect(session?.character.spellSlots[2]?.remaining).toBe(2);
    expect(session?.character.spellSlots[1]?.remaining).toBe(4);
    expect(session?.character.activeEffects).toHaveLength(1);
    expect(session?.journal).toHaveLength(1);
    expect(session?.journal[0]?.summaryRu).toBe("Доспехи мага — ячейкой 2 уровня");
    expect(session?.character.turnTracking.actionAvailable).toBe(false);
  });

  it("после подтверждения мастер закрывается", async () => {
    await renderWithStores(<CombatScreen />);

    const user = await openWizard(/Луч холода/);
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("объявление мастеру (FR-041, AC-12)", () => {
  it("называет выбранный уровень ячейки и цель", async () => {
    await renderWithStores(<CombatScreen />);

    const user = await openWizard(/Маскировка/);
    await user.click(screen.getByRole("button", { name: /Ячейка 3 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Далее" }));

    const announcement = screen.getByLabelText("Объявление мастеру");
    expect(within(announcement).getByText(/ячейкой 3 уровня/)).toBeDefined();
    expect(within(announcement).getByText(/против КС 16/)).toBeDefined();
  });

  it("показывает урон по выбранному уровню ячейки до подтверждения (FR-071)", async () => {
    await renderWithStores(<CombatScreen />);
    const user = await openWizard(/Поглощение стихий/);

    expect(screen.getByRole("button", { name: /Ячейка 1 уровня/ })).toBeDefined();
    expect(within(screen.getByRole("button", { name: /Ячейка 3 уровня/ })).getByText(/3d6/)).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Ячейка 3 уровня/ }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText(/добавит 3d6/)).toBeDefined();
  });

  it("механика и отыгрыш живут в разных блоках (AC-20)", async () => {
    await renderWithStores(<CombatScreen />);
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
    await renderWithStores(<CombatScreen />, withoutSlots());
    const user = await openWizard(/Доспехи мага/);

    expect(screen.getByText("Нет свободной ячейки 1 уровня")).toBeDefined();
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Применить всё равно" }));
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(false);
  });

  it("«Применить всё равно» доводит применение до конца и показывает долг ячейки", async () => {
    const { stores } = await renderWithStores(<CombatScreen />, withoutSlots());
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
    await renderWithStores(<CombatScreen />, concentrating());
    const user = await openWizard(/Обнаружение магии/);

    expect(screen.getByText(/Шаг 1 из 3: Чем сотворить/)).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Далее" }));

    expect(screen.getByText(/Идёт концентрация: «Обнаружение магии»/)).toBeDefined();
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Заменить концентрацию" }));
    expect(screen.getByRole("button", { name: "Далее" }).hasAttribute("disabled")).toBe(false);
  });

  it("после замены остаётся ровно одна концентрация (FR-080)", async () => {
    const { stores } = await renderWithStores(<CombatScreen />, concentrating());
    const user = await openWizard(/Обнаружение магии/);

    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Заменить концентрацию" }));
    await user.click(screen.getByRole("button", { name: "Далее" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    const character = stores.session.getState().session?.character;
    expect(character?.activeEffects.filter((effect) => effect.isConcentration)).toHaveLength(1);
    expect(character?.concentration?.spellId).toBe("detect-magic");
  });

  it("отмена на шаге концентрации оставляет прежний эффект", async () => {
    const { stores } = await renderWithStores(<CombatScreen />, concentrating());
    const before = structuredClone(stores.session.getState().session);
    const user = await openWizard(/Обнаружение магии/);

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
    const user = userEvent.setup();
    // «Опознание» творится минуту, поэтому в режиме «Бой» его нет (FR-201): берём книгу.
    await renderWithStores(<CombatScreen />, { ...createThorne(), screenMode: "book" });

    await user.click(screen.getByRole("button", { name: "Ритуал" }));
    await user.click(screen.getByRole("button", { name: /Опознание/ }));
    await user.click(screen.getByRole("button", { name: "Сотворить" }));
    // Чем сотворить → компоненты → объявление: жемчужина требует отдельного шага.
    await user.click(screen.getByRole("button", { name: "Далее" }));

    expect(screen.getByText(/Шаг 2 из 3: Компоненты/)).toBeDefined();
    expect(screen.getByText(/фокусировка не заменяет/)).toBeDefined();
  });
});

describe("обязательность в блоке отыгрыша (ADR-0011)", () => {
  it("подсвечивает, что вербальное заклинание нужно произнести вслух", async () => {
    await renderWithStores(<CombatScreen />);
    await openWizard(/Луч холода/);

    const roleplay = screen.getByLabelText("Отыгрыш");
    expect(
      within(roleplay).getByText("Обязательно: произнести вслух и сделать жест свободной рукой"),
    ).toBeDefined();
  });

  it("не просит цель и не показывает её отсутствие как пробел (OQ-10)", async () => {
    await renderWithStores(<CombatScreen />);
    await openWizard(/Луч холода/);

    expect(screen.queryByLabelText("Цель или точка")).toBeNull();
    expect(screen.queryByText("Цель не указана")).toBeNull();
  });
})
