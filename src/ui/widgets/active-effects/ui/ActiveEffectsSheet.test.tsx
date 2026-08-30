// @vitest-environment jsdom

/**
 * Шторка «Действует» проверяется отдельно от экрана: компонент презентационный, строки подаются
 * параметром, и строка со своим числом видна рядом со строкой без него.
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { ActiveEffectView } from "@/contract/views";
import { ActiveEffectsSheet } from "@/ui/widgets/active-effects/ui/ActiveEffectsSheet";

afterEach(cleanup);

function show(effects: readonly ActiveEffectView[]): void {
  render(
    <ActiveEffectsSheet
      effects={effects}
      armorClass={14}
      concentration={null}
      onTakeDamage={() => {}}
      onDropConcentration={() => {}}
      onEndEffect={() => {}}
      onAddStatus={() => {}}
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
  noteRu: "+10 футов скорости себе и никаких атак по возможности",
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
