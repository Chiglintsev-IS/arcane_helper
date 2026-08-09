// @vitest-environment jsdom

/**
 * Блок отыгрыша: одна реплика цельной фразой, три категории и управление
 * вариантами.
 *
 * Варианты проверяются на настоящем сторе: компонент берёт строку заклинания сам, потому что
 * рендерится и из карточки, и из мастера применения, — прокидывать её через обоих значило бы завести
 * два источника одной правды.
 *
 * Первый тест сторожит склейку: до этой работы карточка показывала весь список реплик разом, через
 * « · », будто персонаж произносит их подряд. Ожидаемый текст берётся из контента, а не переписан
 * сюда строкой: реплики правятся при вычитке голоса, и тест не должен падать от каждой такой правки.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { RoleplayVariantView } from "@/contract/views";
import type { Spell } from "@/core/domain/catalog/spell";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { AppStores } from "@/ui/shared/model/storeContext";
import { renderWithStores, spell, testSpells } from "@/ui/app/testing/stores";
import { RoleplaySection } from "./RoleplaySection";

/**
 * Книга, в которой у «Щита» три варианта в категории «Коротко». В контенте их по одному на
 * категорию ( требует три на заклинание), а порядок и ротацию видно только на нескольких.
 */
function withThreeShort(): readonly Spell[] {
  const base = spell("shield");
  const changed: Spell = {
    ...base,
    roleplay: {
      ...base.roleplay,
      completeVariants: {
        short: ["Первый.", "Второй.", "Третий."],
        atmospheric: ["Атмосферный."],
        sarcastic: ["Саркастичный."],
      },
    },
  };
  return testSpells.map((card) => (card.id === base.id ? changed : card));
}

/** Варианты категории так, как их прислало ядро: пометки и ротация посчитаны им. */
function variantsOf(stores: AppStores, category = "short"): RoleplayVariantView[] {
  const row = stores.session
    .getState()
    .snapshot?.spells.find((candidate) => candidate.id === "shield");
  return row?.roleplayCategories.find((shown) => shown.id === category)?.variants ?? [];
}

/** Тексты вариантов в порядке показа: только они, без кнопок действий. */
function shownVariants(): string[] {
  return within(screen.getByRole("list", { name: "Варианты отыгрыша" }))
    .getAllByRole("button")
    .map((button) => button.textContent ?? "");
}

const THREE_SHORT = { catalog: withThreeShort() };

describe("реплика и жест", () => {
  it("показывает одну реплику в кавычках", async () => {
    await renderWithStores(<RoleplaySection spellId="ray-of-frost" />);
    expect(screen.getByText(`«${spell("ray-of-frost").roleplay.incantation}»`)).toBeDefined();
  });

  it("не склеивает художественные строки через разделитель", async () => {
    const { container } = await renderWithStores(<RoleplaySection spellId="ray-of-frost" />);
    expect(container.textContent).not.toContain(" · ");
  });

  it("показывает жест как отдельную строку", async () => {
    await renderWithStores(<RoleplaySection spellId="shield" />);
    expect(screen.getByText(spell("shield").roleplay.gesture)).toBeDefined();
  });
});

describe("три категории вариантов (FR-051)", () => {
  it("предлагает короткий, атмосферный и саркастический", async () => {
    await renderWithStores(<RoleplaySection spellId="shield" />);
    for (const label of ["Коротко", "Атмосферно", "Саркастично"]) {
      expect(screen.getByRole("button", { name: label })).toBeDefined();
    }
  });

  it("показывает варианты выбранной категории, а не всех сразу", async () => {
    const user = userEvent.setup();
    const card = spell("shield");
    await renderWithStores(<RoleplaySection spellId="shield" />);

    expect(shownVariants()).toEqual(card.roleplay.completeVariants.short);

    await user.click(screen.getByRole("button", { name: "Саркастично" }));
    expect(shownVariants()).toEqual(card.roleplay.completeVariants.sarcastic);
  });
});

describe("управление вариантами (FR-053)", () => {
  it("при открытии выбран вариант, использованный реже других", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <RoleplaySection spellId="shield" />,
      createThorne(),
      THREE_SHORT,
    );

    expect(screen.getByRole("button", { name: "Первый.", pressed: true })).toBeDefined();

    // Выбор — это и есть использование: показанный уступает место следующему по ротации.
    await user.click(screen.getByRole("button", { name: "Первый." }));
    expect(variantsOf(stores).find((variant) => variant.suggested)?.text).toBe("Второй.");
  });

  it("копирует текст выбранного варианта нажатием", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RoleplaySection spellId="shield" />, createThorne(), THREE_SHORT);

    await user.click(screen.getByRole("button", { name: "Третий." }));
    await user.click(screen.getByRole("button", { name: "Скопировать" }));

    expect(await navigator.clipboard.readText()).toBe("Третий.");
  });

  it("отмечает любимым, и любимый поднимается выше остальных", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <RoleplaySection spellId="shield" />,
      createThorne(),
      THREE_SHORT,
    );

    await user.click(screen.getByRole("button", { name: "Третий." }));
    await user.click(screen.getByRole("button", { name: "В любимые" }));

    expect(variantsOf(stores).filter((variant) => variant.favorite)).toHaveLength(1);
    expect(shownVariants()).toEqual(["Третий.", "Первый.", "Второй."]);
    expect(screen.getByRole("button", { name: "Из любимых" })).toBeDefined();
  });

  it("принимает свой вариант и показывает его первым", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <RoleplaySection spellId="shield" />,
      createThorne(),
      THREE_SHORT,
    );

    await user.click(screen.getByRole("button", { name: "Написать свой" }));
    await user.type(screen.getByLabelText("Свой вариант отыгрыша"), "Мой текст.");
    await user.click(screen.getByRole("button", { name: "Добавить" }));

    expect(shownVariants()[0]).toBe("Мой текст.");
    expect(variantsOf(stores)[0]).toMatchObject({ text: "Мой текст.", own: true });
  });

  it("пустой свой вариант не добавляется", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(
      <RoleplaySection spellId="shield" />,
      createThorne(),
      THREE_SHORT,
    );

    await user.click(screen.getByRole("button", { name: "Написать свой" }));
    await user.click(screen.getByRole("button", { name: "Добавить" }));

    expect(variantsOf(stores).filter((variant) => variant.own)).toHaveLength(0);
    expect(shownVariants()).toEqual(["Первый.", "Второй.", "Третий."]);
  });

  it("отключает нежелательный вариант и возвращает его обратно", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RoleplaySection spellId="shield" />, createThorne(), THREE_SHORT);

    await user.click(screen.getByRole("button", { name: "Второй." }));
    await user.click(screen.getByRole("button", { name: "Отключить" }));
    expect(shownVariants()).toEqual(["Первый.", "Третий."]);

    await user.click(screen.getByRole("button", { name: "Включить: Второй." }));
    expect(shownVariants()).toEqual(["Первый.", "Второй.", "Третий."]);
  });

  it("категория без включённых вариантов пропадает из списка категорий", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RoleplaySection spellId="shield" />, createThorne(), THREE_SHORT);

    await user.click(screen.getByRole("button", { name: "Саркастично" }));
    await user.click(screen.getByRole("button", { name: "Саркастичный." }));
    await user.click(screen.getByRole("button", { name: "Отключить" }));

    expect(screen.queryByRole("button", { name: "Саркастично" })).toBeNull();
    expect(screen.getByRole("button", { name: "Коротко" })).toBeDefined();
  });

  it("последнюю категорию отключить нельзя, и причина названа", async () => {
    const user = userEvent.setup();
    const card = spell("shield");
    const { stores } = await renderWithStores(<RoleplaySection spellId="shield" />);

    for (const category of ["Атмосферно", "Саркастично"]) {
      await user.click(screen.getByRole("button", { name: category }));
      await user.click(screen.getByRole("button", { name: "Отключить" }));
    }

    await user.click(screen.getByRole("button", { name: "Отключить" }));
    expect(stores.session.getState().error).toMatch(/Последний вариант отыгрыша/);
    expect(shownVariants()).toEqual(card.roleplay.completeVariants.short);
  });
});
