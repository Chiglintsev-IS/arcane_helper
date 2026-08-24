// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { knowing } from "@/core/infrastructure/catalog/thorne/fixtures";
import { renderWithStores, testSnapshot, testSpellRow } from "@/ui/app/testing/stores";

import { SpellCardDetails } from "./SpellCardDetails";

const CASTING = testSnapshot().casting;

/** Блок механики: то же название материала стоит и в перечне действий, и в пересказе правил. */
async function mechanicsOf(id: string) {
  await renderWithStores(
    <SpellCardDetails
      row={testSpellRow(id, knowing(createThorne(), "arcane-lock"))}
      casting={CASTING}
      onCast={() => {}}
      onNoteChange={() => {}}
      onClose={() => {}}
    />,
  );
  return within(screen.getByLabelText("Механика"));
}

describe("подробная карточка называет три компонента (FR-011)", () => {
  it("материал, закрытый фокусировкой, назван, а не замолчан", async () => {
    const mechanics = await mechanicsOf("lightning-bolt");

    const material = mechanics.getByText(/кусок шерсти и хрустальная палочка/);
    expect(material.textContent).toContain("заменяет фокусировка");
    // Приглушён, а не спрятан: делать с ним нечего, но снятая фокусировка вернёт требование.
    expect(material.className).not.toBe("");
  });

  it("материал, которого фокусировка не заменяет, назван своим предметом", async () => {
    const mechanics = await mechanicsOf("arcane-lock");

    const material = mechanics.getByText(/золотая пыль/);
    expect(material.textContent).toContain("свой предмет");
    expect(material.className).toBe("");
  });

  it("расходуемый материал называет и то, что сгорает", async () => {
    const mechanics = await mechanicsOf("arcane-lock");

    expect(mechanics.getByText(/золотая пыль/).textContent).toContain("расходуется");
  });

  it("ненужный компонент назван словом: сотворить молча — решение, а не пробел", async () => {
    const mechanics = await mechanicsOf("counterspell");

    expect(mechanics.getByText(/без голоса/)).toBeDefined();
  });

  it("заклинание без материала называет и это", async () => {
    const mechanics = await mechanicsOf("thunder-step");

    expect(mechanics.getByText(/без жеста · без материала/)).toBeDefined();
  });
});
