// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import type { AbilityView } from "@/contract/views";
import type { CharacterState } from "@/core/domain/assembly/state";
import { toSheetView } from "@/core/presentation/views/sheetView";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { AbilitySheet } from "./AbilitySheet";

afterEach(cleanup);

/** Характеристика из настоящей проекции: подделка рядом проверяла бы себя, а не приложение. */
function abilityOf(id: string, character: CharacterState = createThorne()): AbilityView {
  const found = toSheetView(character).abilities.find((ability) => ability.id === id);
  if (found === undefined) throw new Error(`нет характеристики ${id}`);
  return found;
}

describe("шторка характеристики", () => {
  it("характеристика: шторка держит значение, спасбросок и её навыки", async () => {
    const onSave = vi.fn();
    render(
      <AbilitySheet choices={toChoicesView()}
        ability={abilityOf("intelligence")}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    // Ровно пять навыков Интеллекта и ни одного чужого: блок и шторка держат одно и то же.
    expect(screen.getByRole("radiogroup", { name: "Аркана" })).toBeDefined();
    expect(screen.queryByRole("radiogroup", { name: "Скрытность" })).toBeNull();

    const field = screen.getByLabelText("Значение");
    await userEvent.clear(field);
    await userEvent.type(field, "20");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // Владения приходят из листа и возвращаются нетронутыми: правили значение, а не навыки.
    expect(onSave).toHaveBeenCalledWith({
      ability: "intelligence",
      score: 20,
      saveProficient: true,
      skills: { arcana: "proficient", investigation: "proficient", nature: "proficient" },
    });
  });

  it("характеристика: набранное уходит владельцу, а причина отказа приходит от него", async () => {
    const onSave = vi.fn();
    render(
      <AbilitySheet choices={toChoicesView()}
        ability={abilityOf("strength")}
        error="Поле «abilities» не годится"
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    // Годится ли 31, шторка не решает: она передаёт набранное и показывает ответ владельца.
    const field = screen.getByLabelText("Значение");
    await userEvent.clear(field);
    await userEvent.type(field, "31");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].score).toBe(31);
    expect(screen.getByRole("alert").textContent).toContain("не годится");
  });

  it("характеристика: пустое значение не уходит владельцу и отказывает у поля", async () => {
    const onSave = vi.fn();
    render(
      <AbilitySheet choices={toChoicesView()}
        ability={abilityOf("intelligence")}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    const field = screen.getByLabelText("Значение");
    await userEvent.clear(field);
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    // Просьба не собрана: до разбора сообщения она не доходит, и сырого отказа схемы игрок не видит.
    expect(onSave).not.toHaveBeenCalled();
    const reason = screen.getByRole("alert");
    expect(reason.textContent).toBe("Наберите число");
    expect(field.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"));

    await userEvent.type(field, "1");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("характеристика: владение спасброском снимается переключателем", async () => {
    const onSave = vi.fn();
    render(
      <AbilitySheet choices={toChoicesView()}
        ability={abilityOf("intelligence")}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("switch", { name: "Владение спасброском" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].saveProficient).toBe(false);
  });

  it("характеристика: навык переключается в три состояния", async () => {
    const onSave = vi.fn();
    render(
      <AbilitySheet choices={toChoicesView()}
        ability={abilityOf("intelligence")}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    const arcana = screen.getByRole("radiogroup", { name: "Аркана" });
    await userEvent.click(within(arcana).getByRole("radio", { name: "компетентность" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].skills).toEqual({
      arcana: "expert",
      investigation: "proficient",
      nature: "proficient",
    });
  });

  it("характеристика: «нет» убирает навык, а не записывает значение", async () => {
    const onSave = vi.fn();
    const state = createThorne();
    render(
      <AbilitySheet choices={toChoicesView()}
        ability={abilityOf("intelligence", { ...state, skills: { arcana: "proficient" } })}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    const arcana = screen.getByRole("radiogroup", { name: "Аркана" });
    await userEvent.click(within(arcana).getByRole("radio", { name: "нет" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].skills).toEqual({});
  });
});
