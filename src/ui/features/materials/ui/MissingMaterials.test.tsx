// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { materialOf } from "@/core/application/casting/material";
import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { withoutSpellcastingFocus } from "@/core/infrastructure/catalog/thorne/fixtures";
import { toBagView } from "@/core/presentation/views/bagView";

import { MissingMaterials } from "./MissingMaterials";

afterEach(cleanup);

/** Карточки, по которым идёт игра: нехватку собирает их обход, а не список рядом с прогоном. */
const spells = loadThorneSpells();

const NOOP = { onBuy: () => {}, onOpenItem: () => {}, onRefill: () => {} };

const missingOf = (character = createThorne()) => toBagView(character, spells).missingMaterials;

/** Вещь компонента: её слова — и имя строки, и то, чем вещь заводят. */
function materialOfSpell(spellId: string) {
  const spell = spells.find((candidate) => candidate.id === spellId);
  if (spell === undefined) throw new Error(`нет карточки ${spellId}`);
  const material = materialOf(spell.components);
  if (material === undefined) throw new Error(`«${spell.nameRu}» материала не требует`);
  return material;
}

const dust = materialOfSpell("arcane-lock");
const leather = materialOfSpell("mage-armor");

/**
 * Пыль куплена и потрачена: запись о ней есть, запаса не осталось.
 *
 * Фокусировка при этом снята: заведённая вещь и незаведённая стоят в разделе рядом только тогда,
 * когда требований в нём больше одного, а с надетой фокусировкой срочным остаётся ровно золотая пыль.
 */
function withEmptiedDust(): CharacterState {
  const thorne = Character.of(withoutSpellcastingFocus(createThorne()));
  const bought = thorne
    .withItems(thorne.items.addDefinition(dust))
    .withEquipment(thorne.equipment.adjustBagCount(dust.id, 1));
  return bought.withEquipment(bought.equipment.adjustBagCount(dust.id, -1)).toState();
}

/** Строка раздела, названная своей вещью: место в списке сдвинет любая правка состава книги. */
function rowNamed(list: HTMLElement, nameRu: string): HTMLElement {
  const row = within(list)
    .getAllByRole("listitem")
    .find((candidate) => candidate.textContent?.includes(nameRu) === true);
  if (row === undefined) throw new Error(`нет строки «${nameRu}»`);
  return row;
}

describe("«Покупки» в «Вещах»", () => {
  it("строкой стоит то, без чего не сотворить, а закрытое фокусировкой — перечнем имён (FR-296)", () => {
    render(<MissingMaterials missing={missingOf()} {...NOOP} />);

    // Своё требуется купить: строка называет цену, судьбу и того, кто его требует.
    const rows = within(screen.getByRole("list", { name: "Купить" })).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("золотая пыль");
    expect(rows[0]?.textContent).toContain("25 зм · расходуется · Требуется для: Волшебный замок");

    // Закрытое фокусировкой названо целиком — и прямо сказано, что покупать его не обязательно.
    const covered = screen.getByText(/Закрывает фокусировка/);
    expect(covered.textContent).toContain("покупать не обязательно");
    expect(covered.textContent).toContain("кусок обработанной кожи");
    expect(covered.textContent).toContain("перо");
  });

  it("снятая фокусировка делает несрочное срочным", () => {
    render(
      <MissingMaterials missing={missingOf(withoutSpellcastingFocus(createThorne()))} {...NOOP} />,
    );

    // Закрывать нечем — каждое требование стало строкой, и перечня несрочного нет вовсе.
    expect(screen.queryByText(/Закрывает фокусировка/)).toBeNull();
    expect(
      screen.getByRole("button", { name: `Добавить один в сумку: ${leather.nameRu}` }),
    ).toBeDefined();

    // Строка называет только то, что назвала карточка: ни цены, ни расхода у такого требования нет,
    // и приложение их не выдумывает.
    const line = rowNamed(screen.getByRole("list", { name: "Купить" }), leather.nameRu).textContent;
    expect(line).toContain("Требуется для: Доспехи мага");
    expect(line).not.toContain("зм");
    expect(line).not.toContain("расходуется");
  });

  it("нехватка заводит вещь одним нажатием (FR-296)", async () => {
    const user = userEvent.setup();
    const onBuy = vi.fn();
    render(<MissingMaterials missing={missingOf()} {...NOOP} onBuy={onBuy} />);

    await user.click(screen.getByRole("button", { name: /Добавить один в сумку: золотая пыль/ }));

    // Вещь заводит карточка: цену и судьбу приложение берёт у неё, а не спрашивает у игрока.
    expect(onBuy).toHaveBeenCalledWith("arcane-lock");
  });

  it("строка заведённой вещи открывает её, а строка незаведённой не гаснет (FR-302)", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    const onRefill = vi.fn();
    render(
      <MissingMaterials
        missing={missingOf(withEmptiedDust())}
        {...NOOP}
        onOpenItem={onOpenItem}
        onRefill={onRefill}
      />,
    );

    // Обе строки — одна с записью, другая без — стоят в разделе одинаково и целиком.
    const list = screen.getByRole("list", { name: "Купить" });
    expect(rowNamed(list, dust.nameRu).textContent).toContain(
      "25 зм · расходуется · Требуется для: Волшебный замок",
    );
    expect(rowNamed(list, leather.nameRu).textContent).toContain("Требуется для: Доспехи мага");
    // Погашенного в разделе нет ни одного: открывать нечего — значит действия нет вовсе.
    for (const button of within(list).getAllByRole("button")) {
      expect(button).toHaveProperty("disabled", false);
    }

    // Заведённая вещь открывается и пополняется своей строкой — переезд ничего у неё не отнял.
    await user.click(screen.getByRole("button", { name: `Правка: ${dust.nameRu}` }));
    expect(onOpenItem).toHaveBeenCalledWith(dust.id);
    await user.click(
      screen.getByRole("button", { name: `Добавить один в сумку: ${dust.nameRu}` }),
    );
    expect(onRefill).toHaveBeenCalledWith(dust.id);

    // Незаведённой вещи открывать нечего: открывающего действия у её строки нет вовсе.
    expect(screen.queryByRole("button", { name: `Правка: ${leather.nameRu}` })).toBeNull();
  });

  it("список покупок пополняет заведённое той же кнопкой, что заводит незаведённое (FR-302)", async () => {
    const user = userEvent.setup();
    const onBuy = vi.fn();
    const onRefill = vi.fn();
    render(
      <MissingMaterials
        missing={missingOf(withEmptiedDust())}
        {...NOOP}
        onBuy={onBuy}
        onRefill={onRefill}
      />,
    );

    // У заведённой вещи плюс тот же, каким её пополняли в категории.
    await user.click(
      screen.getByRole("button", { name: `Добавить один в сумку: ${dust.nameRu}` }),
    );
    expect(onRefill).toHaveBeenCalledWith(dust.id);

    // Незаведённую тот же плюс заводит по словам карточки.
    await user.click(
      screen.getByRole("button", { name: `Добавить один в сумку: ${leather.nameRu}` }),
    );
    expect(onBuy).toHaveBeenCalledWith("mage-armor");
  });

  it("пустые покупки отвечают словами, а не молчанием", () => {
    render(<MissingMaterials missing={[]} {...NOOP} />);

    // Заголовка у покупок своего нет — их называет переключатель, которым их открыли.
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("Всё нужное лежит в сумке.")).toBeDefined();
  });
});
