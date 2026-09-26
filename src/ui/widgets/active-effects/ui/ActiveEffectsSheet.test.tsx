// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

import type { ActiveEffectView } from "@/contract/views";
import { WRITTEN } from "@/ui/shared/ui/FieldForm";
import { ActiveEffectsSheet } from "@/ui/widgets/active-effects/ui/ActiveEffectsSheet";

afterEach(cleanup);

type Props = Parameters<typeof ActiveEffectsSheet>[0];

function show(
  effects: readonly ActiveEffectView[],
  handlers: Partial<Pick<Props, "onAddStatus" | "onRenameStatus">> = {},
): void {
  render(
    <ActiveEffectsSheet
      effects={effects}
      armorClass={14}
      concentration={null}
      onTakeDamage={() => {}}
      onDropConcentration={() => {}}
      onEndEffect={() => {}}
      onAddStatus={handlers.onAddStatus ?? (() => WRITTEN)}
      onRenameStatus={handlers.onRenameStatus ?? (() => WRITTEN)}
      onOpenMarks={() => {}}
      onClose={() => {}}
    />,
  );
}

const WIND_RUNE: ActiveEffectView = {
  id: "effect-1",
  nameRu: "Руна ветра",
  endConditionRu: "Держится до начала вашего следующего хода.",
  isConcentration: false,
  changesArmorClass: false,
  renamable: false,
  noteRu: "+10 футов скорости себе и никаких атак по возможности",
};

const TYPED_STATUS: ActiveEffectView = {
  id: "effect-2",
  nameRu: "Опутан",
  endConditionRu: "Снимается вручную.",
  isConcentration: false,
  changesArmorClass: false,
  renamable: true,
};

describe("строка руны называет её число и срок (FR-334)", () => {
  it("число стоит в строке вместе с именем руны и мгновением, которым срок кончится", () => {
    show([WIND_RUNE]);

    const [row] = within(screen.getByLabelText("Активные эффекты")).getAllByRole("listitem");
    expect(row?.textContent).toContain("Руна ветра");
    expect(row?.textContent).toContain("+10 футов скорости");
    expect(row?.textContent).toContain("до начала вашего следующего хода");
  });

  it("защиту руна не двигает, и КД в строке не называется", () => {
    show([WIND_RUNE]);

    const [row] = within(screen.getByLabelText("Активные эффекты")).getAllByRole("listitem");
    expect(row?.textContent).not.toContain("КД");
  });

  it("эффекту без числа лишней строки не достаётся", () => {
    const { noteRu: _noteRu, ...withoutNote } = WIND_RUNE;
    show([withoutNote]);

    const [row] = within(screen.getByLabelText("Активные эффекты")).getAllByRole("listitem");
    expect(row?.textContent).not.toContain("футов");
  });
});

describe("ручной статус", () => {
  it("добавляется явной кнопкой без Enter", () => {
    const onAddStatus = vi.fn<Props["onAddStatus"]>(() => WRITTEN);
    show([], { onAddStatus });

    const field = screen.getByLabelText("Новый статус");
    fireEvent.change(field, { target: { value: "Опутанный" } });
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));

    expect(onAddStatus).toHaveBeenCalledWith("Опутанный");
  });

  it("набранное уходит из поля, только когда записано: отказ оставляет его с причиной", async () => {
    const user = userEvent.setup();
    const refusal = "Название эффекта не может быть пустым";
    show([], { onAddStatus: () => Promise.resolve(refusal) });

    await user.type(screen.getByLabelText("Новый статус"), "Опутанный");
    await user.click(screen.getByRole("button", { name: "Добавить" }));

    expect(screen.getByRole("alert").textContent).toBe(refusal);
    expect(screen.getByLabelText<HTMLTextAreaElement>("Новый статус").value).toBe("Опутанный");
  });

  it("набранный статус правится формой под своей строкой", async () => {
    const user = userEvent.setup();
    const onRenameStatus = vi.fn<Props["onRenameStatus"]>(() => WRITTEN);
    show([TYPED_STATUS], { onRenameStatus });

    await user.click(screen.getByRole("button", { name: "Правка: Опутан" }));
    await user.type(screen.getByLabelText("Название"), "ный");
    await user.click(screen.getByRole("button", { name: "Записать" }));

    expect(onRenameStatus).toHaveBeenCalledWith("effect-2", "Опутанный");
    expect(screen.queryByLabelText("Название")).toBeNull();
  });

  it("эффект руны или заклинания правки названия не предлагает", () => {
    show([WIND_RUNE]);

    expect(screen.queryByRole("button", { name: "Правка: Руна ветра" })).toBeNull();
  });
});
