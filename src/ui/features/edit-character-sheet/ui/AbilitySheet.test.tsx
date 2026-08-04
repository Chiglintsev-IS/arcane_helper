// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createThorne } from "@/core/infrastructure/catalog/thorne/character";
import { AbilitySheet } from "./AbilitySheet";

afterEach(cleanup);

describe("шторка характеристики", () => {
  it("характеристика: шторка держит значение, спасбросок и её навыки", async () => {
    const onSave = vi.fn();
    render(
      <AbilitySheet
        ability="intelligence"
        character={createThorne()}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    // Ровно пять навыков Интеллекта и ни одного чужого: блок и шторка держат одно и то же.
    expect(screen.getByRole("radiogroup", { name: "Магия" })).toBeDefined();
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

  it("характеристика: значение вне диапазона не сохраняется", async () => {
    render(
      <AbilitySheet
        ability="strength"
        character={createThorne()}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );

    const field = screen.getByLabelText("Значение");
    await userEvent.clear(field);
    await userEvent.type(field, "31");

    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveProperty("disabled", true);
  });

  it("характеристика: владение спасброском снимается переключателем", async () => {
    const onSave = vi.fn();
    render(
      <AbilitySheet
        ability="intelligence"
        character={createThorne()}
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
      <AbilitySheet
        ability="intelligence"
        character={createThorne()}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    const arcana = screen.getByRole("radiogroup", { name: "Магия" });
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
      <AbilitySheet
        ability="intelligence"
        character={{ ...state, skills: { arcana: "proficient" } }}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );

    const arcana = screen.getByRole("radiogroup", { name: "Магия" });
    await userEvent.click(within(arcana).getByRole("radio", { name: "нет" }));
    await userEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onSave.mock.calls[0]?.[0].skills).toEqual({});
  });
});
