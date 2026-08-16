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

const pearl = materialOfSpell("identify");

/** Жемчужина куплена и истрачена: запись о ней есть, запаса не осталось. */
function withEmptiedPearl(): CharacterState {
  const thorne = Character.of(createThorne());
  const bought = thorne
    .withItems(thorne.items.addDefinition(pearl))
    .withEquipment(thorne.equipment.adjustBagCount(pearl.id, 1));
  return bought.withEquipment(bought.equipment.adjustBagCount(pearl.id, -1)).toState();
}

describe("раздел «Чего не хватает»", () => {
  it("строкой стоит то, без чего не сотворить, а закрытое фокусировкой — перечнем имён (FR-296)", () => {
    render(<MissingMaterials missing={missingOf()} {...NOOP} />);

    // Своё требуется купить: строка называет цену, судьбу и того, кто его требует.
    const rows = within(screen.getByRole("list", { name: "Купить" })).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("уголь, благовония и травы");
    expect(rows[0]?.textContent).toContain("10 зм · расходуется · Требуется для: Поиск фамильяра");
    expect(rows[1]?.textContent).toContain("100 зм · Требуется для: Опознание");

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
      screen.getByRole("button", { name: "Добавить один в сумку: кусок обработанной кожи" }),
    ).toBeDefined();
  });

  it("нехватка заводит вещь одним нажатием (FR-296)", async () => {
    const user = userEvent.setup();
    const onBuy = vi.fn();
    render(<MissingMaterials missing={missingOf()} {...NOOP} onBuy={onBuy} />);

    await user.click(screen.getByRole("button", { name: /Добавить один в сумку: жемчужина/ }));

    // Вещь заводит карточка: цену и судьбу приложение берёт у неё, а не спрашивает у игрока.
    expect(onBuy).toHaveBeenCalledWith("identify");
  });

  it("строка заведённой вещи открывает её, а строка незаведённой не гаснет (FR-302)", async () => {
    const user = userEvent.setup();
    const onOpenItem = vi.fn();
    const onRefill = vi.fn();
    render(
      <MissingMaterials
        missing={missingOf(withEmptiedPearl())}
        {...NOOP}
        onOpenItem={onOpenItem}
        onRefill={onRefill}
      />,
    );

    // Обе строки — одна с записью, другая без — стоят в разделе одинаково и целиком.
    const list = screen.getByRole("list", { name: "Купить" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[1]?.textContent).toContain("100 зм · Требуется для: Опознание");
    // Погашенного в разделе нет ни одного: открывать нечего — значит действия нет вовсе.
    for (const button of within(list).getAllByRole("button")) {
      expect(button).toHaveProperty("disabled", false);
    }

    // Заведённая вещь открывается и пополняется своей строкой — переезд ничего у неё не отнял.
    await user.click(screen.getByRole("button", { name: `Открыть: ${pearl.nameRu}` }));
    expect(onOpenItem).toHaveBeenCalledWith(pearl.id);
    await user.click(screen.getByRole("button", { name: `Добавить один в сумку: ${pearl.nameRu}` }));
    expect(onRefill).toHaveBeenCalledWith(pearl.id);

    // Незаведённой вещи открывать нечего: открывающего действия у её строки нет вовсе.
    expect(screen.queryByRole("button", { name: /Открыть: уголь/ })).toBeNull();
  });

  it("пустой раздел отвечает словами, а не молчанием", () => {
    render(<MissingMaterials missing={[]} {...NOOP} />);

    expect(screen.getByRole("heading", { name: "Чего не хватает" })).toBeDefined();
    expect(screen.getByText("Всё нужное лежит в сумке.")).toBeDefined();
  });
});
