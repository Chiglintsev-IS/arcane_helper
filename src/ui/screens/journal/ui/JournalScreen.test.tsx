// @vitest-environment jsdom

/**
 * «Журнал» на настоящем состоянии: моков нет.
 *
 * Обмен данными живёт здесь: это операция над всем сохранением, а не над одним числом. Отмена
 * записи и то, чего в журнале нет, проверяются у оболочки — сделать запись можно только в «Игре».
 */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { loadThorneSpells } from "@/core/infrastructure/catalog/thorne";
import { exportSnapshot } from "@/core/application/dataExchange";
import type { CharacterState } from "@/core/domain/assembly/state";
import { renderWithStores, shown, slotsLeft } from "@/ui/app/testing/stores";
import { JournalScreen } from "@/ui/screens/journal/ui/JournalScreen";
import { withSpentSlots } from "@/core/infrastructure/catalog/thorne/fixtures";

/** Выгрузка приложения, снятая с текущего состояния: её же и загружаем обратно. */
async function openData(character: CharacterState = createThorne()) {
  const user = userEvent.setup();
  const rendered = await renderWithStores(<JournalScreen />, character);
  await user.click(screen.getByRole("button", { name: "Данные" }));
  return { user, ...rendered };
}

describe("выгрузка и загрузка (FR-120, FR-121, FR-122)", () => {
  it("битый файл называет причину и состояние не трогает (FR-121, FR-122)", async () => {
    const { user, stores } = await openData();
    const before = shown(stores).spells.filter((row) => row.prepared).map((row) => row.id);

    await user.type(screen.getByLabelText("Данные для загрузки"), "не файл");
    await user.click(screen.getByRole("button", { name: "Загрузить" }));

    expect(screen.getByRole("alert").textContent).toContain("не JSON");
    expect(shown(stores).spells.filter((row) => row.prepared).map((row) => row.id)).toEqual(before);
  });

  it("своя выгрузка загружается обратно и восстанавливает ресурсы (FR-120)", async () => {
    const saved = exportSnapshot(createThorne(), loadThorneSpells(), "2026-07-31T18:00:00.000Z");

    const spent = withSpentSlots(createThorne(), 1, 4);
    const { user, stores } = await openData(spent);

    // `type` посимвольно на длинном JSON слишком медленный: вставляем как из буфера.
    await user.click(screen.getByLabelText("Данные для загрузки"));
    await user.paste(JSON.stringify(saved));
    await user.click(screen.getByRole("button", { name: "Загрузить" }));

    expect(slotsLeft(stores, 1)).toBe(4);
    // Журнал начинается заново: записи прежнего персонажа к новому состоянию не относятся.
    expect(shown(stores).journal).toEqual([]);
  });

});
