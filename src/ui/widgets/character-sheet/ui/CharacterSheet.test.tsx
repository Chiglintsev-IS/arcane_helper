// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import type { CharacterState } from "@/core/domain/assembly/state";
import { createWizard } from "@/core/infrastructure/catalog/thorne/fixtures";
import { toChoicesView } from "@/core/presentation/views/choicesView";
import { toSheetView } from "@/core/presentation/views/sheetView";
import { renderWithStores } from "@/ui/app/testing/stores";
import { WRITTEN } from "@/ui/shared/ui/FieldForm";

import { CharacterSheet } from "./CharacterSheet";

afterEach(cleanup);

type Props = Parameters<typeof CharacterSheet>[0];

function sheetOf(
  state: CharacterState = createWizard(),
  handlers: Partial<Pick<Props, "onWriteIdentity" | "onWriteLevel">> = {},
) {
  return (
    <CharacterSheet
      sheet={toSheetView(state)}
      choices={toChoicesView()}
      onWriteIdentity={handlers.onWriteIdentity ?? (() => WRITTEN)}
      onWriteLevel={handlers.onWriteLevel ?? (() => WRITTEN)}
    />
  );
}

describe("вкладка «Кто он»", () => {
  it("карточки того, что спрашивают раз за вечер, и ничего из боя (FR-230)", () => {
    render(sheetOf());

    expect(screen.getByRole("heading", { name: "Кто он" })).toBeDefined();
    expect(screen.getByText("Тролль")).toBeDefined();

    expect(screen.queryByRole("heading", { name: "Интеллект" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Отметки мастера" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Числа боя" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Вещи" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Навыки" })).toBeNull();
  });

  it("того, что двигает игра, на листе нет: ни защиты, ни хитов (FR-230)", () => {
    const state = createWizard();
    render(
      sheetOf({
        ...state,
        temporaryHitPoints: 5,
        hitPoints: { ...state.hitPoints, current: 24, maximumBase: 38, bloodReduction: 4 },
      }),
    );

    expect(screen.queryByRole("heading", { name: "Здоровье" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Класс Доспеха" })).toBeNull();
    expect(screen.queryByText("24 из 34")).toBeNull();
  });

  it("строка открывает форму под собой, и длинное значение в ней читается целиком", async () => {
    const user = userEvent.setup();
    const onWriteIdentity = vi.fn<Props["onWriteIdentity"]>(() => WRITTEN);
    render(sheetOf(createWizard(), { onWriteIdentity }));

    await user.click(screen.getByRole("button", { name: /^Вид/ }));
    const field = screen.getByLabelText("Вид");
    expect(field.tagName).toBe("TEXTAREA");
    await user.clear(field);
    await user.type(field, "Лунный тролль из северных болот Гормонголя");
    expect(onWriteIdentity).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onWriteIdentity).toHaveBeenCalledWith({
      species: "Лунный тролль из северных болот Гормонголя",
    });
    expect(screen.queryByLabelText("Вид")).toBeNull();
  });

  it("отказ владельца оставляет форму с набранным и причиной у поля", async () => {
    const user = userEvent.setup();
    const refusal = "Имя не может быть пустым";
    render(sheetOf(createWizard(), { onWriteIdentity: () => Promise.resolve(refusal) }));

    await user.click(screen.getByRole("button", { name: /^Имя/ }));
    await user.clear(screen.getByLabelText("Имя"));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(screen.getByRole("alert").textContent).toBe(refusal);
    expect(screen.getByLabelText("Имя")).toBeDefined();
  });

  it("владения режутся по запятой, а соседние списки уходят нетронутыми", async () => {
    const user = userEvent.setup();
    const onWriteIdentity = vi.fn<Props["onWriteIdentity"]>(() => WRITTEN);
    const state = createWizard();
    render(
      sheetOf(
        { ...state, proficiencies: { ...state.proficiencies, languages: ["Общий"] } },
        { onWriteIdentity },
      ),
    );

    await user.click(screen.getByRole("button", { name: /^Оружие/ }));
    await user.clear(screen.getByLabelText("Оружие"));
    await user.type(screen.getByLabelText("Оружие"), "кинжал, боевой посох ,");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    const written = onWriteIdentity.mock.calls[0]?.[0].proficiencies;
    expect(written?.weapons).toEqual(["кинжал", "боевой посох"]);
    expect(written?.languages).toEqual(["Общий"]);
  });

  it("размер выбирается кнопкой, скорость — числом", async () => {
    const user = userEvent.setup();
    const onWriteIdentity = vi.fn<Props["onWriteIdentity"]>(() => WRITTEN);
    render(sheetOf(createWizard(), { onWriteIdentity }));

    await user.click(screen.getByRole("button", { name: /^Размер/ }));
    await user.click(screen.getByRole("radio", { name: "Огромный" }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(onWriteIdentity).toHaveBeenLastCalledWith({ size: "huge" });

    await user.click(screen.getByRole("button", { name: /^Своя скорость/ }));
    await user.clear(screen.getByLabelText("Своя скорость"));
    await user.type(screen.getByLabelText("Своя скорость"), "25");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(onWriteIdentity).toHaveBeenLastCalledWith({ speed: 25 });
  });

  it("пустое число не уходит владельцу и отказывает у поля", async () => {
    const user = userEvent.setup();
    const onWriteIdentity = vi.fn<Props["onWriteIdentity"]>(() => WRITTEN);
    render(sheetOf(createWizard(), { onWriteIdentity }));

    await user.click(screen.getByRole("button", { name: /^Своя скорость/ }));
    const speed = screen.getByLabelText("Своя скорость");
    await user.clear(speed);
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onWriteIdentity).not.toHaveBeenCalled();
    const reasons = screen.getAllByRole("alert");
    expect(reasons.map((reason) => reason.textContent)).toEqual(["Наберите число"]);
    expect(speed.getAttribute("aria-describedby")).toBe(reasons[0]?.getAttribute("id"));
  });

  it("без изменений форма закрывается, ничего не записав", async () => {
    const user = userEvent.setup();
    const onWriteIdentity = vi.fn<Props["onWriteIdentity"]>(() => WRITTEN);
    render(sheetOf(createWizard(), { onWriteIdentity }));

    await user.click(screen.getByRole("button", { name: /^Вид/ }));
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    expect(onWriteIdentity).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Вид")).toBeNull();
  });

  it("уровень правится своей строкой и называет, что изменится", async () => {
    const user = userEvent.setup();
    const onWriteLevel = vi.fn<Props["onWriteLevel"]>(() => WRITTEN);
    await renderWithStores(sheetOf(createWizard(), { onWriteLevel }));

    await user.click(screen.getByRole("button", { name: /^Уровень/ }));
    await user.clear(screen.getByLabelText("Уровень"));
    await user.type(screen.getByLabelText("Уровень"), "8");
    expect(await screen.findByText(/Кости хитов: 7 → 8/)).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Сохранить" }));
    expect(onWriteLevel).toHaveBeenCalledWith({ level: 8, hitPointMaximumBase: 60 });
    expect(screen.queryByLabelText("Уровень")).toBeNull();
  });

  it("«Лист»: особенность стоит карточкой и правки не предлагает (FR-230)", () => {
    render(sheetOf());

    expect(screen.getByRole("heading", { name: "Особенности" })).toBeDefined();
    expect(screen.getByText("Почерк рун")).toBeDefined();
    expect(screen.getByText(/Минута над записью/)).toBeDefined();
    const card = screen.getByRole("heading", { name: "Особенности" }).closest("section");
    expect(card?.querySelector("button")).toBeNull();
  });

  it("особенностей нет ни одной — карточка называет пустоту прочерком", () => {
    render(sheetOf({ ...createWizard(), features: [] }));

    const card = screen.getByRole("heading", { name: "Особенности" }).closest("section");
    expect(card?.textContent).toContain("—");
    expect(card?.textContent).not.toContain("Почерк рун");
  });
});

