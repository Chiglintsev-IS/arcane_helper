"use client";

import { useState, useEffect } from "react";

import { DEFAULT_SCREEN_MODE, SCREEN_MODES, type ScreenMode } from "@/ui/shared/model/screenMode";
import { readRemembered, writeRemembered } from "@/ui/shared/model/rememberedChoice";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { BottomNav } from "@/ui/features/screen-mode/ui/BottomNav";
import { ServiceWorkerUpdate } from "@/ui/features/app-update/ui/ServiceWorkerUpdate";
import { UnreadableSave } from "@/ui/app/UnreadableSave";
import { GameScreen } from "@/ui/screens/game/ui/GameScreen";
import { BookScreen } from "@/ui/screens/book/ui/BookScreen";
import { SheetScreen } from "@/ui/screens/sheet/ui/SheetScreen";
import { ThingsScreen } from "@/ui/screens/things/ui/ThingsScreen";
import { CraftingScreen } from "@/ui/screens/crafting/ui/CraftingScreen";
import { RestScreen } from "@/ui/screens/rest/ui/RestScreen";
import { JournalScreen } from "@/ui/screens/journal/ui/JournalScreen";
import { NotesScreen } from "@/ui/screens/notes/ui/NotesScreen";
import { SURFACE_PANEL } from "@/ui/shared/ui/surface";

const STORAGE_KEY = "playScreenMode";

function ScreenContent({ mode }: { mode: ScreenMode }) {
  switch (mode) {
    case "play":
      return <GameScreen />;
    case "book":
      return <BookScreen />;
    case "sheet":
      return <SheetScreen />;
    case "things":
      return <ThingsScreen />;
    case "crafting":
      return <CraftingScreen />;
    case "rest":
      return <RestScreen />;
    case "journal":
      return <JournalScreen />;
    case "notes":
      return <NotesScreen />;
  }
}

export function PlayShell({ initialMode }: { initialMode?: ScreenMode } = {}) {
  const { session: sessionStore } = useStores();
  const snapshot = useSession((state) => state.snapshot);
  const status = useSession((state) => state.status);
  const error = useSession((state) => state.error);

  const [mode, setMode] = useState<ScreenMode>(() => initialMode ?? DEFAULT_SCREEN_MODE);

  // Статическая сборка отдаёт разметку без хранилища: прочитанный до гидратации режим разошёлся бы
  // с отданным сервером.
  useEffect(() => {
    if (initialMode === undefined) {
      setMode(readRemembered(STORAGE_KEY, SCREEN_MODES, DEFAULT_SCREEN_MODE));
    }
  }, [initialMode]);

  // Играть не на чем, а данные целы: вместо режимов — причина и выход из неё.
  if (status === "error" && snapshot === null) return <UnreadableSave />;

  if (status === "loading" || snapshot === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4 text-sm text-ink-quiet">
        Загрузка состояния…
      </main>
    );
  }

  const changeMode = (next: ScreenMode): void => {
    setMode(next);
    writeRemembered(STORAGE_KEY, next);
  };

  // Верхний системный отступ держит оболочка: приложение с домашнего экрана открывается под
  // полупрозрачной строкой состояния, и содержимое уходило бы под неё.
  return (
    <main className="flex h-dvh flex-col pt-[env(safe-area-inset-top)]">
      <ScreenContent mode={mode} />

      <div className="relative shrink-0">
        {/*
 Полосы висят над панелью поверх содержимого: в потоке они сдвигали список ровно в тот момент,
 когда игрок метил в его строку, а поверх панели — отнимали единственную навигацию. Нижний край
 стопки — верхний край панели, поэтому её высоту не приходится знать числом.
 */}
        <div className="absolute inset-x-3 bottom-full z-20 mb-2 flex flex-col gap-2">
          {error === null ? null : (
            <p
              role="alert"
              className={`p-2 text-xs font-medium text-reaction ${SURFACE_PANEL}`}
            >
              {error}{" "}
              <button
                type="button"
                onClick={() => sessionStore.getState().dismissError()}
                className="underline"
              >
                Понятно
              </button>
            </p>
          )}

          <ServiceWorkerUpdate />
        </div>

        <BottomNav mode={mode} onChange={changeMode} />
      </div>
    </main>
  );
}
