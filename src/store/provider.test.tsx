// @vitest-environment jsdom

import "fake-indexeddb/auto";

import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createThorne } from "@/data/content/thorne/character";
import { createTestStores, spell } from "@/testing/stores";
import { castSpell, longRest } from "./session";
import {
  createBrowserStores,
  StoreProvider,
  systemClock,
  useDraft,
  useSession,
  useStores,
} from "./provider";

function Slots() {
  const remaining = useSession((state) => state.session?.character.spellSlots[1]?.remaining ?? null);
  return <output>ячейки 1 уровня: {remaining}</output>;
}

function DraftName() {
  const name = useDraft((state) => state.draft?.spell.nameRu ?? "черновика нет");
  return <output>{name}</output>;
}

describe("StoreProvider", () => {
  it("отдаёт компонентам состояние из стора", async () => {
    const stores = await createTestStores();
    render(
      <StoreProvider stores={stores}>
        <Slots />
      </StoreProvider>,
    );

    expect(screen.getByText("ячейки 1 уровня: 4")).toBeDefined();
  });

  it("перерисовывает компонент при изменении состояния", async () => {
    const stores = await createTestStores();
    render(
      <StoreProvider stores={stores}>
        <Slots />
      </StoreProvider>,
    );

    act(() => {
      stores.session.getState().apply((session) =>
        castSpell(
          session,
          { spell: spell("mage-armor"), mode: "normal", payment: { kind: "slot", slotLevel: 1 } },
          stores.clock,
        ),
      );
    });
    expect(screen.getByText("ячейки 1 уровня: 3")).toBeDefined();

    act(() => {
      stores.session.getState().apply((session) => longRest(session, stores.clock));
    });
    expect(screen.getByText("ячейки 1 уровня: 4")).toBeDefined();
  });

  it("загружает состояние сам, если оно ещё не прочитано", async () => {
    const stores = await createTestStores();
    // Возвращаем стор в исходное состояние: провайдер обязан вызвать загрузку сам.
    act(() => {
      stores.session.setState({ session: null, status: "loading" });
    });

    render(
      <StoreProvider stores={stores}>
        <Slots />
      </StoreProvider>,
    );

    await waitFor(() => {
      expect(stores.session.getState().status).toBe("ready");
    });
  });

  it("отдаёт черновик применения отдельным стором", async () => {
    const stores = await createTestStores();
    render(
      <StoreProvider stores={stores}>
        <DraftName />
      </StoreProvider>,
    );

    expect(screen.getByText("черновика нет")).toBeDefined();
  });

  it("без провайдера сообщает об ошибке, а не молча ломается", () => {
    function Orphan() {
      useStores();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(/вне StoreProvider/);
  });
});

describe("сторы для браузера", () => {
  it("собираются на IndexedDB и читают состояние Торна", async () => {
    const stores = createBrowserStores();
    await stores.session.getState().hydrate();

    expect(stores.session.getState().session?.character.name).toBe(createThorne().name);
  });

  it("часы приложения дают время в ISO и разные идентификаторы", () => {
    const clock = systemClock();
    expect(Number.isNaN(Date.parse(clock.now()))).toBe(false);
    expect(clock.nextId()).not.toBe(clock.nextId());
  });
});
