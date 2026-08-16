// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { withoutSpellcastingFocus } from "@/core/infrastructure/catalog/thorne/fixtures";
import { toBagView } from "@/core/presentation/views/bagView";

import { MissingMaterials } from "./MissingMaterials";

afterEach(cleanup);

/** Карточки, по которым идёт игра: нехватку собирает их обход, а не список рядом с прогоном. */
const spells = loadThorneSpells();

const missingOf = (character = createThorne()) => toBagView(character, spells).missingMaterials;

describe("раздел «Чего не хватает»", () => {
  it("строкой стоит то, без чего не сотворить, а закрытое фокусировкой — перечнем имён (FR-296)", () => {
    render(<MissingMaterials missing={missingOf()} onBuy={() => {}} />);

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
    render(<MissingMaterials missing={missingOf(withoutSpellcastingFocus(createThorne()))} onBuy={() => {}} />);

    // Закрывать нечем — каждое требование стало строкой, и перечня несрочного нет вовсе.
    expect(screen.queryByText(/Закрывает фокусировка/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Добавить один в сумку: кусок обработанной кожи" }),
    ).toBeDefined();
  });

  it("нехватка заводит вещь одним нажатием (FR-296)", async () => {
    const user = userEvent.setup();
    const onBuy = vi.fn();
    render(<MissingMaterials missing={missingOf()} onBuy={onBuy} />);

    await user.click(
      screen.getByRole("button", { name: /Добавить один в сумку: жемчужина/ }),
    );

    // Вещь заводит карточка: цену и судьбу приложение берёт у неё, а не спрашивает у игрока.
    expect(onBuy).toHaveBeenCalledWith("identify");
  });

  it("пустой раздел отвечает словами, а не молчанием", () => {
    render(<MissingMaterials missing={[]} onBuy={() => {}} />);

    expect(screen.getByRole("heading", { name: "Чего не хватает" })).toBeDefined();
    expect(screen.getByText("Всё нужное лежит в сумке.")).toBeDefined();
  });
});
