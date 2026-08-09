// @vitest-environment jsdom

/**
 * Предпросмотр набранного: ответ приходит на последний вопрос и только на него.
 *
 * Проверяется поведение самого спрашивающего, а не правил: что он спрашивает, когда есть о чём, и
 * что снятый с экрана вопрос ответа уже не показывает.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Preview, Question } from "@/contract/questions";
import { createTestStores } from "@/ui/app/testing/stores";
import { StoreProvider } from "@/ui/app/providers/stores";
import type { AppStores } from "./storeContext";

import { usePreview } from "./usePreview";

function Shown({ question }: { question: Question | null }) {
  const preview = usePreview(question);
  return (
    <p>{preview?.kind === "health_preview" ? `максимум ${preview.effectiveMaximum}` : "нет"}</p>
  );
}

async function shown(question: Question | null, stores?: AppStores): Promise<AppStores> {
  const ready = stores ?? (await createTestStores());
  render(
    <StoreProvider stores={ready}>
      <Shown question={question} />
    </StoreProvider>,
  );
  return ready;
}

describe("предпросмотр набранного", () => {
  it("ответ приходит от ядра, а не считается на месте", async () => {
    await shown({ kind: "health_preview", maximumBase: 70, masterReduction: 10 });

    expect(await screen.findByText("максимум 60")).toBeDefined();
  });

  it("спрашивать нечего — ничего и не показано", async () => {
    await shown(null);

    expect(screen.getByText("нет")).toBeDefined();
  });

  it("ответ на снятый с экрана вопрос не показывается", async () => {
    const stores = await createTestStores();
    let answer: (preview: Preview | null) => void = () => {};
    stores.session.setState({
      ask: async () => await new Promise<Preview | null>((resolve) => (answer = resolve)),
    });

    const view = render(
      <StoreProvider stores={stores}>
        <Shown question={{ kind: "health_preview", maximumBase: 70, masterReduction: 0 }} />
      </StoreProvider>,
    );
    view.unmount();
    answer({ kind: "health_preview", effectiveMaximum: 60 });

    expect(screen.queryByText("максимум 60")).toBeNull();
  });
});
