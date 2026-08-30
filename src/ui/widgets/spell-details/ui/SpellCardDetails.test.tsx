// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { knowing } from "@/core/infrastructure/catalog/thorne/fixtures";
import { renderWithStores, testSnapshot, testSpellRow } from "@/ui/app/testing/stores";

import { SpellCardDetails } from "./SpellCardDetails";

const CASTING = testSnapshot().casting;

async function cardOf(id: string, onToggleMaterial: () => void = () => {}) {
  return await renderWithStores(
    <SpellCardDetails
      row={testSpellRow(id, knowing(createThorne(), "arcane-lock"))}
      casting={CASTING}
      onCast={() => {}}
      onNoteChange={() => {}}
      onToggleMaterial={onToggleMaterial}
      onClose={() => {}}
    />,
  );
}

async function mechanicsOf(id: string) {
  await cardOf(id);
  return within(screen.getByLabelText("Механика"));
}

describe("подробная карточка называет требуемые компоненты (FR-011)", () => {
  it("материал, закрытый фокусировкой, назван, а не замолчан", async () => {
    const mechanics = await mechanicsOf("lightning-bolt");

    const material = mechanics.getByText(/кусок шерсти и хрустальная палочка/);
    expect(material.textContent).toContain("заменяет фокусировка");
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

  it("ненужный компонент не называется: строка говорит, что нужно", async () => {
    const mechanics = await mechanicsOf("counterspell");

    expect(mechanics.getByText("жест")).toBeDefined();
    expect(mechanics.queryByText(/без голоса|без материала/)).toBeNull();
  });

  it("заклинание из одного голоса называет только его", async () => {
    const mechanics = await mechanicsOf("thunder-step");

    expect(mechanics.getByText("голос")).toBeDefined();
  });

  it("свой компонент покупают и тратят с карточки, закрытый фокусировкой — не покупают", async () => {
    const user = userEvent.setup();
    const bought = vi.fn();
    await cardOf("arcane-lock", bought);

    await user.click(screen.getByRole("button", { name: "Купить компонент" }));
    expect(bought).toHaveBeenCalled();

    cleanup();
    await cardOf("lightning-bolt");
    expect(screen.queryByRole("button", { name: /компонент/ })).toBeNull();
  });
});
