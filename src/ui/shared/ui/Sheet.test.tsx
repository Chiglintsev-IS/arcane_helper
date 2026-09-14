// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Sheet } from "./Sheet";

afterEach(cleanup);

const SCREEN_HEIGHT = 800;

const ORIGINAL_HEIGHT = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");

/**
 * jsdom вёрстку не считает и всякую высоту отдаёт нулём: рост шторки называет прогон. Высота
 * достаётся каждой части — заголовку, содержимому и подвалу.
 */
function growEachPart(height: number): void {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: height });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: SCREEN_HEIGHT });
}

afterEach(() => {
  if (ORIGINAL_HEIGHT !== undefined) {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", ORIGINAL_HEIGHT);
  }
});

function renderSheet(): void {
  render(
    <Sheet titleRu="Свойства" footer={<button type="button">Закрыть</button>}>
      <p>Что известно про вещь.</p>
    </Sheet>,
  );
}

describe("шторка выбирает вид по своему росту", () => {
  it("невысокая выезжает снизу и оставляет экран видимым", () => {
    growEachPart(40);
    renderSheet();

    expect(screen.getByRole("dialog", { name: "Свойства" }).className).toContain("bottom-0");
  });

  it("переросшая долю экрана открывается страницей: нажимать мимо неё нечего", () => {
    growEachPart(200);
    renderSheet();

    const sheet = screen.getByRole("dialog", { name: "Свойства" });

    expect(sheet.className).toContain("inset-0");
    expect(sheet.className).not.toContain("bottom-0");
  });

  it("имя шторки — её заголовок, пока дело не зовётся другими словами", () => {
    growEachPart(40);
    render(
      <Sheet titleRu="Деньги" nameRu="Правка: Деньги">
        <p>Монеты.</p>
      </Sheet>,
    );

    expect(screen.getByRole("dialog", { name: "Правка: Деньги" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Деньги" })).toBeDefined();
  });
});
