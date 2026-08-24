// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";

import { renderWithStores, testSnapshot, testSpellRow } from "@/ui/app/testing/stores";

import { SpellCardDetails } from "./SpellCardDetails";

const CASTING = testSnapshot().casting;

/** Блок механики: то же название материала стоит и в перечне действий, и в пересказе правил. */
async function mechanicsOf(id: string) {
  await renderWithStores(
    <SpellCardDetails
      row={testSpellRow(id)}
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
    const mechanics = await mechanicsOf("find-familiar");

    const material = mechanics.getByText(/уголь, благовония и травы/);
    expect(material.textContent).toContain("свой предмет");
    expect(material.className).toBe("");
  });

  it("расходуемый материал называет и то, что сгорает", async () => {
    const mechanics = await mechanicsOf("find-familiar");

    expect(mechanics.getByText(/уголь, благовония и травы/).textContent).toContain("расходуется");
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
