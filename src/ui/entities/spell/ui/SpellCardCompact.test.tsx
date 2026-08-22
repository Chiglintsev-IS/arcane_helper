// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { testSnapshot } from "@/ui/app/testing/stores";

import { SpellCardCompact } from "./SpellCardCompact";

// Автоматической очистки нет: тесты не пользуются глобалями vitest.
afterEach(cleanup);

const SNAPSHOT = testSnapshot();
const BASE_ROW = SNAPSHOT.spells[0]!;

/** Строка одного заклинания: прогон называет заклинания, а не места в списке. */
function rowOf(id: string) {
  const found = SNAPSHOT.spells.find((row) => row.id === id);
  if (found === undefined) throw new Error(`нет строки ${id}`);
  return found;
}

function renderRow(id: string) {
  return render(
    <SpellCardCompact spell={rowOf(id)} casting={SNAPSHOT.casting} onOpen={() => {}} />,
  );
}

describe("SpellCardCompact — дальность в ряду фактов без ярлыка", () => {
  it("особая дальность называет себя сама, а не показывает голое «Особая»", () => {
    render(
      <SpellCardCompact
        spell={{ ...BASE_ROW, range: { type: "special" } }}
        casting={SNAPSHOT.casting}
        onOpen={() => {}}
      />,
    );

    expect(screen.getByText("Особая дальность")).toBeDefined();
    expect(screen.queryByText("Особая", { exact: true })).toBeNull();
  });
});

describe("роль строки названа тремя носителями", () => {
  it("знак, слово и левая линейка — цвет последний, а не единственный", () => {
    const { container } = renderRow("lightning-bolt");

    // Убрать цвет совсем — строка обязана остаться понятной: знак и слово стоят рядом.
    expect(screen.getByText(/Боевое/).textContent).toBe("✚ Боевое");
    // Обводить строку целиком роль перестала: цвет ушёл на край и места у списка не занял.
    const row = container.querySelector("button");
    expect(row?.className).toContain("border-l-offense");
    expect(row?.className).not.toContain("border-offense");
  });

  it("«ни то, ни другое» линейку получает нейтральную, а не пустую", () => {
    const { container } = renderRow("detect-magic");

    const row = container.querySelector("button");
    expect(row?.className).toContain("border-l-[3px]");
    expect(row?.className).toContain("border-l-rule-strong");
  });
});

describe("ряд фактов строки списка", () => {
  it("разделитель берёт тон ряда, а не заводит свой", () => {
    // Свой тон у разделителя был один на обе темы, и на белой подложке светлой темы точка давала
    // 2.63 при требуемых 4.5. Тон ряда назван парой и проходит в обеих; axe этого не ловит —
    // разделитель скрыт от чтения вслух, и правило контраста его обходит.
    renderRow("lightning-bolt");

    const separators = screen.getAllByText("·");
    expect(separators).toHaveLength(2);
    for (const separator of separators) expect(separator.className).toBe("");
  });
});

describe("компоненты на строке списка (FR-010)", () => {
  it("требуемое названо буквой, а не требуемое не названо вовсе", () => {
    // «Сообщение» творится молча: голоса оно не требует, и буквы за него не получает.
    renderRow("message");

    const components = screen.getByRole("img", { name: /^Компоненты/ });
    expect(components.textContent).toBe("СМ");
    expect(components.getAttribute("aria-label")).toBe("Компоненты: жест, материал");
  });

  it("материал, которого фокусировка не заменяет, выделен среди букв", () => {
    renderRow("identify");

    const components = screen.getByRole("img", { name: /^Компоненты/ });
    const [verbal, somatic, material] = [...components.children];
    expect(components.getAttribute("aria-label")).toBe("Компоненты: голос, жест, свой предмет");
    expect(verbal?.className).toBe("");
    expect(somatic?.className).toBe("");
    expect(material?.className).not.toBe("");
  });

  it("буквы встают в угол имени, а не заводят своей строки", () => {
    renderRow("lightning-bolt");

    const components = screen.getByRole("img", { name: /^Компоненты/ });
    // Тот же угол, что и знак с подписью роли: своей строки буквы не заводят, и список не растёт.
    expect(components.parentElement?.textContent).toBe("ВСМ✚ Боевое");
  });

  it("строка того, что не требует ничего, компонентов и не называет", () => {
    render(
      <SpellCardCompact
        spell={{
          ...BASE_ROW,
          card: { ...BASE_ROW.card, components: { verbal: false, somatic: false } },
        }}
        casting={SNAPSHOT.casting}
        onOpen={() => {}}
      />,
    );

    expect(screen.queryByRole("img", { name: /^Компоненты/ })).toBeNull();
  });
});
