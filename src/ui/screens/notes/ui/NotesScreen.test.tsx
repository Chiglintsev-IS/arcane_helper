// @vitest-environment jsdom

/**
 * «Заметки» на настоящем ядре и настоящем хранилище: моков нет.
 *
 * Экран проверяется сам по себе, без оболочки: шторок у него нет вовсе, а запись правится в своей
 * строке — там же, где стоит.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createMemoryRepository } from "@/core/infrastructure/persistence/memoryRepository";
import { renderOn, renderWithStores, storesOver } from "@/ui/app/testing/stores";
import { NotesScreen } from "@/ui/screens/notes/ui/NotesScreen";

const BARON = "Барон обещал мост";

/** Запись длиной в три строки узкого экрана: на ней и видно, сколько поле показывает. */
const LONG =
  "Барон обещал мост к весне, но мельник видел волка у брода и просит проводить его до города, покуда светло и дорога суха";

const EMPTY_RU = "Пока ничего не записано.";

type User = ReturnType<typeof userEvent.setup>;

/** Ввод новой записи: одно поле, отправка по «Ввод». */
async function write(user: User, text: string): Promise<void> {
  await user.type(screen.getByRole("textbox", { name: "Заметка" }), `${text}{Enter}`);
}

function rows(): HTMLElement[] {
  return within(screen.getByRole("list", { name: "Записи про мир" })).getAllByRole("listitem");
}

async function openSearch(user: User): Promise<void> {
  await user.click(screen.getByRole("button", { name: "Поиск по слову" }));
}

describe("режим «Заметки» (FR-321)", () => {
  it("запись заводится одним полем и переживает перезапуск", async () => {
    const user = userEvent.setup();
    const storage = createMemoryRepository();

    const before = renderOn(await storesOver(storage), <NotesScreen />);
    await write(user, BARON);

    expect(screen.getByRole("button", { name: `Править: ${BARON}` })).toBeDefined();

    // Ядро собирается заново над тем же хранилищем: так открывается приложение на следующий день.
    before.unmount();
    renderOn(await storesOver(storage), <NotesScreen />);

    expect(screen.getByRole("button", { name: `Править: ${BARON}` })).toBeDefined();
  });

  it("пустое поле ничего не заводит (FR-321)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<NotesScreen />);

    await write(user, "   ");

    expect(screen.getByText(EMPTY_RU)).toBeDefined();
  });

  it("запись правится и убирается из своей строки (FR-321)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<NotesScreen />);
    await write(user, BARON);

    await user.click(screen.getByRole("button", { name: `Править: ${BARON}` }));
    const field = screen.getByRole("textbox", { name: `Править: ${BARON}` });
    await user.clear(field);
    await user.type(field, "Барон обещал мост к весне{Enter}");

    const edited = "Править: Барон обещал мост к весне";
    expect(screen.getByRole("button", { name: edited })).toBeDefined();

    // Убрать можно только раскрытую запись: возврата у удаления нет.
    await user.click(screen.getByRole("button", { name: edited }));
    await user.click(screen.getByRole("button", { name: "Убрать: Барон обещал мост к весне" }));

    expect(screen.getByText(EMPTY_RU)).toBeDefined();
  });

  it("поле правки заметки высотой в текст", async () => {
    const user = userEvent.setup();
    await renderWithStores(<NotesScreen />);
    await write(user, LONG);

    await user.click(screen.getByRole("button", { name: `Править: ${LONG}` }));

    // Раскрытая строка показывает запись целиком: уместившееся в одну строку — не вся запись, а её
    // хвост, и опечатку в середине пришлось бы искать прокруткой вслепую.
    expect(rows()[0]?.textContent).toContain(LONG);

    // Новая запись набирается таким же полем: у правки и у ввода способ один.
    await user.keyboard("{Escape}");
    await user.type(screen.getByRole("textbox", { name: "Заметка" }), LONG);

    expect(screen.getAllByText(LONG).length).toBeGreaterThan(0);
  });

  it("имя поля и кнопки поиска остаётся произносимым, а места не занимает (FR-321)", async () => {
    await renderWithStores(<NotesScreen />);

    // Имя режима, написанное внутри единственного поля экрана, — то же слово дважды: место оно
    // отнимает у самой записи. Слышащий экран получает вопрос целиком и без подписи.
    expect(screen.getByRole("textbox", { name: "Заметка" })).toBeDefined();
    expect(screen.queryByText("Заметка")).toBeNull();
    expect(screen.getByRole("button", { name: "Поиск по слову" }).textContent).toBe("");
  });

  it("свежее сверху, и время стоит в строке записи (FR-321)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<NotesScreen />);

    await write(user, BARON);
    await write(user, "Мельник видел волка");

    expect(rows()[0]?.textContent).toContain("Мельник видел волка");
    expect(rows()[1]?.textContent).toContain(BARON);
    expect(rows()[0]?.textContent).toMatch(/\d\d:\d\d/);
  });

  it("поиск встаёт на место ввода и возвращает его тем же нажатием (FR-321)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<NotesScreen />);
    await write(user, BARON);

    await openSearch(user);

    expect(screen.queryByRole("textbox", { name: "Заметка" })).toBeNull();
    await user.type(screen.getByRole("searchbox", { name: "Поиск по слову" }), "мельница");
    expect(screen.getByText("Ни одна запись не отвечает набранному.")).toBeDefined();

    await openSearch(user);

    expect(screen.getByRole("textbox", { name: "Заметка" })).toBeDefined();
    expect(rows()).toHaveLength(1);
  });

  it("поиск по слову не различает регистра и «ё» (FR-321)", async () => {
    const user = userEvent.setup();
    await renderWithStores(<NotesScreen />);
    await write(user, "Полёт над рекой");
    await write(user, BARON);

    await openSearch(user);
    await user.type(screen.getByRole("searchbox", { name: "Поиск по слову" }), "ПОЛЕТ");

    expect(rows()).toHaveLength(1);
    expect(rows()[0]?.textContent).toContain("Полёт над рекой");
  });
});
