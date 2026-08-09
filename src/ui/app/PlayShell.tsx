"use client";

import { useState, useEffect } from "react";

import { DEFAULT_SCREEN_MODE, SCREEN_MODES, type ScreenMode } from "@/ui/shared/model/screenMode";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { ModeSwitcher } from "@/ui/features/screen-mode/ui/ModeSwitcher";
import { GameScreen } from "@/ui/screens/game/ui/GameScreen";
import { BookScreen } from "@/ui/screens/book/ui/BookScreen";
import { SheetScreen } from "@/ui/screens/sheet/ui/SheetScreen";
import { BagScreen } from "@/ui/screens/bag/ui/BagScreen";
import { RestScreen } from "@/ui/screens/rest/ui/RestScreen";
import { JournalScreen } from "@/ui/screens/journal/ui/JournalScreen";

const STORAGE_KEY = "playScreenMode";

function storedMode(): string | null {
  // Приватный режим Safari бросает на самом обращении к хранилищу: выбор режима не стоит того,
  // чтобы приложение из-за него не открылось.
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function readMode(): ScreenMode {
  if (typeof window === "undefined") return DEFAULT_SCREEN_MODE;
  const stored = storedMode();
  return SCREEN_MODES.find((mode) => mode === stored) ?? DEFAULT_SCREEN_MODE;
}

function writeMode(mode: ScreenMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    return;
  }
}

function ScreenContent({ mode }: { mode: ScreenMode }) {
  switch (mode) {
    case "play":
      return <GameScreen />;
    case "book":
      return <BookScreen />;
    case "sheet":
      return <SheetScreen />;
    case "bag":
      return <BagScreen />;
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
      setMode(readMode());
    }
  }, [initialMode]);

  if (status === "loading" || snapshot === null) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4 text-sm text-slate-500">
        {status === "error" ? (error ?? "Состояние не прочитано") : "Загрузка состояния…"}
      </main>
    );
  }

  const changeMode = (next: ScreenMode): void => {
    setMode(next);
    writeMode(next);
  };

  return (
    <main className="flex h-dvh flex-col">
      <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
        <ModeSwitcher mode={mode} onChange={changeMode} />

        {error === null ? null : (
          <p role="alert" className="rounded-lg border border-reaction bg-reaction/10 p-2 text-xs">
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
      </div>

      <ScreenContent mode={mode} />
    </main>
  );
}
