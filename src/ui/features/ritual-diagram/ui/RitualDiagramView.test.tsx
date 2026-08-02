// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { spell } from "@/ui/app/testing/stores";
import { RitualDiagramView } from "./RitualDiagramView";

describe("полноэкранный вид схемы (FR-192)", () => {
  it("показывает название ритуала, схему и подпись", () => {
    render(<RitualDiagramView spell={spell("identify")} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: /Схема ритуала «Опознание»/ })).toBeDefined();
    expect(screen.getByRole("img", { name: "Схема ритуала" })).toBeDefined();
    const caption = spell("identify").ritualDiagram?.captionRu;
    if (caption === undefined) throw new Error("у «Опознания» нет подписи схемы");
    expect(screen.getByText(caption)).toBeDefined();
  });

  it("закрывается кнопкой", async () => {
    const onClose = vi.fn();
    render(<RitualDiagramView spell={spell("identify")} onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("у заклинания без схемы не показывает ничего (FR-190)", () => {
    const { container } = render(
      <RitualDiagramView spell={spell("ray-of-frost")} onClose={() => {}} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("кнопки печати нет: смысл в том, чтобы вести линию рукой", () => {
    render(<RitualDiagramView spell={spell("identify")} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /Печать|Печатать/ })).toBeNull();
  });
});
