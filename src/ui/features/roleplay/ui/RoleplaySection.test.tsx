// @vitest-environment jsdom

/**
 * Блок отыгрыша: одна реплика цельной фразой, три категории и управление
 * вариантами.
 *
 * Предпочтения проверяются на настоящем сторе: компонент читает их сам, потому что рендерится и из
 * карточки, и из мастера применения, — прокидывать их через обоих значило бы завести два источника
 * одной правды.
 *
 * Первый тест сторожит склейку: до этой работы карточка показывала весь список реплик разом, через
 * « · », будто персонаж произносит их подряд. Ожидаемый текст берётся из контента, а не переписан
 * сюда строкой: реплики правятся при вычитке голоса, и тест не должен падать от каждой такой правки.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { Spell } from "@/core/domain/catalog/spell";
import type { AppStores } from "@/ui/shared/model/storeContext";
import { renderWithStores, spell } from "@/ui/app/testing/stores";
import { RoleplaySection } from "./RoleplaySection";

/**
 * Карточка с тремя вариантами в категории «Коротко». В контенте их по одному на категорию
 * ( требует три на заклинание), а порядок и ротацию видно только на нескольких.
 */
function threeShort(): Spell {
  const base = spell("shield");
  return {
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
}

function preferences(stores: AppStores) {
  return stores.session.getState().session?.character.roleplayPreferences.shield;
}

/** Тексты вариантов в порядке показа: только они, без кнопок действий. */
function shownVariants(): string[] {
  return within(screen.getByRole("list", { name: "Варианты отыгрыша" }))
    .getAllByRole("button")
    .map((button) => button.textContent ?? "");
}

describe("реплика и жест", () => {
  it("показывает одну реплику в кавычках", async () => {
    await renderWithStores(<RoleplaySection spell={spell("ray-of-frost")} />);
    expect(screen.getByText(`«${spell("ray-of-frost").roleplay.incantation}»`)).toBeDefined();
  });

  it("не склеивает художественные строки через разделитель", async () => {
    const { container } = await renderWithStores(<RoleplaySection spell={spell("ray-of-frost")} />);
    expect(container.textContent).not.toContain(" · ");
  });

  it("показывает жест как отдельную строку", async () => {
    await renderWithStores(<RoleplaySection spell={spell("shield")} />);
    expect(screen.getByText(spell("shield").roleplay.gesture)).toBeDefined();
  });
});

describe("три категории вариантов (FR-051)", () => {
  it("предлагает короткий, атмосферный и саркастический", async () => {
    await renderWithStores(<RoleplaySection spell={spell("shield")} />);
    for (const label of ["Коротко", "Атмосферно", "Саркастично"]) {
      expect(screen.getByRole("button", { name: label })).toBeDefined();
    }
  });

  it("показывает варианты выбранной категории, а не всех сразу", async () => {
    const user = userEvent.setup();
    const card = spell("shield");
    await renderWithStores(<RoleplaySection spell={card} />);

    expect(shownVariants()).toEqual(card.roleplay.completeVariants.short);

    await user.click(screen.getByRole("button", { name: "Саркастично" }));
    expect(shownVariants()).toEqual(card.roleplay.completeVariants.sarcastic);
  });
});

describe("управление вариантами (FR-053)", () => {
  it("при открытии выбран вариант, использованный реже других", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RoleplaySection spell={threeShort()} />);

    expect(screen.getByRole("button", { name: "Первый.", pressed: true })).toBeDefined();

    // Выбор — это и есть использование: в следующий раз показан будет другой вариант.
    await user.click(screen.getByRole("button", { name: "Второй." }));
    expect(preferences(stores)?.usageCount).toEqual({ "short-1": 1 });
  });

  it("копирует текст выбранного варианта нажатием", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RoleplaySection spell={threeShort()} />);

    await user.click(screen.getByRole("button", { name: "Третий." }));
    await user.click(screen.getByRole("button", { name: "Скопировать" }));

    expect(await navigator.clipboard.readText()).toBe("Третий.");
  });

  it("отмечает любимым, и любимый поднимается выше остальных", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RoleplaySection spell={threeShort()} />);

    await user.click(screen.getByRole("button", { name: "Третий." }));
    await user.click(screen.getByRole("button", { name: "В любимые" }));

    expect(preferences(stores)?.favoriteVariantIds).toEqual(["short-2"]);
    expect(shownVariants()).toEqual(["Третий.", "Первый.", "Второй."]);
    expect(screen.getByRole("button", { name: "Из любимых" })).toBeDefined();
  });

  it("принимает свой вариант и показывает его первым", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RoleplaySection spell={threeShort()} />);

    await user.click(screen.getByRole("button", { name: "Написать свой" }));
    await user.type(screen.getByLabelText("Свой вариант отыгрыша"), "Мой текст.");
    await user.click(screen.getByRole("button", { name: "Добавить" }));

    expect(shownVariants()[0]).toBe("Мой текст.");
    expect(preferences(stores)?.customVariants[0]?.category).toBe("short");
  });

  it("пустой свой вариант не добавляется", async () => {
    const user = userEvent.setup();
    const { stores } = await renderWithStores(<RoleplaySection spell={threeShort()} />);

    await user.click(screen.getByRole("button", { name: "Написать свой" }));
    await user.click(screen.getByRole("button", { name: "Добавить" }));

    expect(preferences(stores)?.customVariants ?? []).toHaveLength(0);
    expect(shownVariants()).toEqual(["Первый.", "Второй.", "Третий."]);
  });

  it("отключает нежелательный вариант и возвращает его обратно", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RoleplaySection spell={threeShort()} />);

    await user.click(screen.getByRole("button", { name: "Второй." }));
    await user.click(screen.getByRole("button", { name: "Отключить" }));
    expect(shownVariants()).toEqual(["Первый.", "Третий."]);

    await user.click(screen.getByRole("button", { name: "Включить: Второй." }));
    expect(shownVariants()).toEqual(["Первый.", "Второй.", "Третий."]);
  });

  it("категория без включённых вариантов пропадает из списка категорий", async () => {
    const user = userEvent.setup();
    await renderWithStores(<RoleplaySection spell={threeShort()} />);

    await user.click(screen.getByRole("button", { name: "Саркастично" }));
    await user.click(screen.getByRole("button", { name: "Саркастичный." }));
    await user.click(screen.getByRole("button", { name: "Отключить" }));

    expect(screen.queryByRole("button", { name: "Саркастично" })).toBeNull();
    expect(screen.getByRole("button", { name: "Коротко" })).toBeDefined();
  });

  it("последнюю категорию отключить нельзя, и причина названа", async () => {
    const user = userEvent.setup();
    const card = spell("shield");
    const { stores } = await renderWithStores(<RoleplaySection spell={card} />);

    for (const category of ["Атмосферно", "Саркастично"]) {
      await user.click(screen.getByRole("button", { name: category }));
      await user.click(screen.getByRole("button", { name: "Отключить" }));
    }

    await user.click(screen.getByRole("button", { name: "Отключить" }));
    expect(stores.session.getState().error).toMatch(/Последний вариант отыгрыша/);
    expect(shownVariants()).toEqual(card.roleplay.completeVariants.short);
  });
});
