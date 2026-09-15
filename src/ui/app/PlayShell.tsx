"use client";

import { useState, useEffect } from "react";

import {
  DEFAULT_SCREEN_MODE,
  SCREEN_LABELS,
  SCREEN_MODES,
  type ScreenMode,
} from "@/ui/shared/model/screenMode";
import { readRemembered, writeRemembered } from "@/ui/shared/model/rememberedChoice";
import { useSession, useStores } from "@/ui/shared/model/storeContext";
import { BottomNav } from "@/ui/features/screen-mode/ui/BottomNav";
import { ServiceWorkerUpdate } from "@/ui/features/app-update/ui/ServiceWorkerUpdate";
import { UnreadableSave } from "@/ui/app/UnreadableSave";
import { GameScreen } from "@/ui/screens/game/ui/GameScreen";
import { BookScreen } from "@/ui/screens/book/ui/BookScreen";
import { SheetScreen } from "@/ui/screens/sheet/ui/SheetScreen";
import { ThingsScreen } from "@/ui/screens/things/ui/ThingsScreen";
import { AlchemyScreen } from "@/ui/screens/alchemy/ui/AlchemyScreen";
import { SmithingScreen } from "@/ui/screens/smithing/ui/SmithingScreen";
import { FamiliarScreen } from "@/ui/screens/familiar/ui/FamiliarScreen";
import { RestScreen } from "@/ui/screens/rest/ui/RestScreen";
import { LogScreen } from "@/ui/screens/log/ui/LogScreen";
import { NotesScreen } from "@/ui/screens/notes/ui/NotesScreen";
import { SURFACE_PANEL } from "@/ui/shared/ui/surface";

const STORAGE_KEY = "playScreenMode";

/**
 * Уход за одной записью на чужой экран: визит помнит саму запись, экран, который её сейчас
 * показывает, и тот, с которого за ней пришли. Возврат без записи высадил бы игрока в список,
 * откуда он только что ушёл в карточку.
 */
type Visit = { readonly itemId: string; readonly at: ScreenMode; readonly whence: ScreenMode | null };

function ScreenContent({
  mode,
  visit,
  onOpenAlchemy,
  onReturn,
}: {
  mode: ScreenMode;
  visit: Visit | null;
  onOpenAlchemy: (itemId: string) => void;
  onReturn: () => void;
}) {
  switch (mode) {
    case "play":
      return <GameScreen />;
    case "book":
      return <BookScreen />;
    case "sheet":
      return <SheetScreen />;
    case "things":
      return visit?.at === "things" ? (
        <ThingsScreen initialItemId={visit.itemId} onOpenAlchemy={onOpenAlchemy} />
      ) : (
        <ThingsScreen onOpenAlchemy={onOpenAlchemy} />
      );
    case "alchemy":
      return visit?.at !== "alchemy" ? (
        <AlchemyScreen />
      ) : visit.whence === null ? (
        <AlchemyScreen initialKindId={visit.itemId} />
      ) : (
        <AlchemyScreen
          initialKindId={visit.itemId}
          whenceNameRu={SCREEN_LABELS[visit.whence].title}
          onLeave={onReturn}
        />
      );
    case "smithing":
      return <SmithingScreen />;
    case "familiar":
      return <FamiliarScreen />;
    case "rest":
      return <RestScreen />;
    case "log":
      return <LogScreen />;
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
  /* Вид, ради которого ушли в алхимию: страница вещи обещает открыть её там, а не просто режим. */
  const [visit, setVisit] = useState<Visit | null>(null);

  useEffect(() => {
    if (initialMode === undefined) {
      setMode(readRemembered(STORAGE_KEY, SCREEN_MODES, DEFAULT_SCREEN_MODE));
    }
  }, [initialMode]);

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
    setVisit(null);
    writeRemembered(STORAGE_KEY, next);
  };

  return (
    <main className="flex h-dvh flex-col pt-[env(safe-area-inset-top)]">
      <ScreenContent
        mode={mode}
        visit={visit}
        onOpenAlchemy={(itemId) => {
          changeMode("alchemy");
          setVisit({ itemId, at: "alchemy", whence: mode });
        }}
        onReturn={() => {
          const back = visit?.whence ?? DEFAULT_SCREEN_MODE;
          changeMode(back);
          if (visit !== null) setVisit({ itemId: visit.itemId, at: back, whence: null });
        }}
      />

      <div className="relative shrink-0">
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
