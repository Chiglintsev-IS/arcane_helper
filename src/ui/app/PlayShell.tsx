"use client";

import { useState, useEffect } from "react";

import { DEFAULT_SCREEN_MODE, SCREEN_MODES, type ScreenMode } from "@/ui/shared/model/screenMode";
import { readRemembered, writeRemembered } from "@/ui/shared/model/rememberedChoice";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { BottomNav } from "@/ui/features/screen-mode/ui/BottomNav";
import { UnreadableSave } from "@/ui/app/UnreadableSave";
import { GameScreen } from "@/ui/screens/game/ui/GameScreen";
import { BookScreen } from "@/ui/screens/book/ui/BookScreen";
import { SheetScreen } from "@/ui/screens/sheet/ui/SheetScreen";
import { ThingsScreen } from "@/ui/screens/things/ui/ThingsScreen";
import { CraftingScreen } from "@/ui/screens/crafting/ui/CraftingScreen";
import { RestScreen } from "@/ui/screens/rest/ui/RestScreen";
import { JournalScreen } from "@/ui/screens/journal/ui/JournalScreen";
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
      <main className="flex min-h-dvh items-center justify-center p-4 text-sm text-slate-600 dark:text-slate-400">
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
 Полоса висит над панелью поверх содержимого: в потоке она сдвигала список ровно в тот момент,
 когда игрок метил в его строку.
 */}
        {error === null ? null : (
          <p
            role="alert"
            className={`absolute inset-x-3 bottom-full z-20 mb-2 rounded-lg p-2 text-xs font-medium text-reaction-strong dark:text-reaction-bright ${SURFACE_PANEL}`}
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

        <BottomNav mode={mode} onChange={changeMode} />
      </div>
    </main>
  );
}
