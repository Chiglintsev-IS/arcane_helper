// @vitest-environment jsdom

/**
 * Шторка реакций сама по себе, без «Игры»: чем она названа, отвечает она, а не кнопка, её открывшая.
 */

import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { IN_FIGHT, renderWithStores, testSnapshot, testSpellRows } from "@/ui/app/testing/stores";
import { ReactionsSheet } from "./ReactionsSheet";

/** Строки, руны и нерастраченная реакция приезжают из настоящего снимка начатого боя. */
async function openReactions(): Promise<void> {
  const character = createThorne();
  const snapshot = testSnapshot(character, IN_FIGHT);
  await renderWithStores(
    <ReactionsSheet
      rows={testSpellRows(character, IN_FIGHT)}
      armorClass={snapshot.sheet.armorClass}
      runesRemaining={snapshot.resources.runes.remaining}
      reactionAvailable={snapshot.turn.reactionAvailable}
      runeAvailable={snapshot.resources.wardingSigilAvailable}
      onCast={() => {}}
      onSpendRune={() => {}}
      onClose={() => {}}
    />,
    character,
    { inFight: true },
  );
}

describe("шторка реакций называет своё дело (FR-274)", () => {
  it("реакции: заголовок зовётся тем же словом, что и кнопка снаружи", async () => {
    await openReactions();

    const sheet = screen.getByRole("dialog", { name: "Реакции" });
    const title = within(sheet).getByRole("heading", { name: "Реакции" });

    // Имя шторки не вторая копия заголовка, а он сам: расходиться двум строкам здесь не с чем.
    expect(sheet.getAttribute("aria-labelledby")).toBe(title.id);
    expect(sheet.hasAttribute("aria-label")).toBe(false);
  });

  it("реакции: вопрос о событии виден и ведёт выбор", async () => {
    await openReactions();

    const question = screen.getByText("Что произошло?");
    const events = screen.getByRole("radiogroup", { name: "Что произошло?" });

    // Вопрос назван один раз: слышащий его и видящий читают одну и ту же строку.
    expect(events.getAttribute("aria-labelledby")).toBe(question.id);
    expect(within(events).getByRole("radio", { name: "По мне попали" })).toBeDefined();
  });
});
