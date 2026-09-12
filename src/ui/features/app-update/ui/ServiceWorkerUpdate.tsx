"use client";

import { useEffect, useState } from "react";
import { SURFACE_PANEL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export function ServiceWorkerUpdate() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [postponed, setPostponed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let known: ServiceWorkerRegistration | null = null;

    const watch = (candidate: ServiceWorkerRegistration): void => {
      known = candidate;
      if (candidate.waiting !== null) setWaiting(candidate.waiting);
      candidate.addEventListener("updatefound", () => {
        const installing = candidate.installing;
        if (installing === null) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller !== null) {
            setWaiting(installing);
          }
        });
      });
    };

    const look = (): void => {
      if (known === null) {
        void navigator.serviceWorker.register("./sw.js").then(watch, () => undefined);
        return;
      }
      void known.update().catch(() => undefined);
    };

    look();

    /**
     * Приложение на домашнем экране телефона не перезагружается неделями: его сворачивают и
     * разворачивают, а страница остаётся та же. Одного взгляда при запуске мало — новая версия
     * ждала бы на раздаче, пока игрок не закроет приложение совсем. Смотрим при каждом возвращении:
     * раздача включена не всегда, и неудачная попытка ничего не стоит.
     */
    const lookOnReturn = (): void => {
      if (document.visibilityState === "visible") look();
    };

    document.addEventListener("visibilitychange", lookOnReturn);
    return () => document.removeEventListener("visibilitychange", lookOnReturn);
  }, []);

  if (waiting === null || postponed) return null;

  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-2 p-2 text-sm ${SURFACE_PANEL}`}
    >
      <span>Готово обновление.</span>
      <span className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setPostponed(true)}
          className="min-h-11 px-2 text-sm underline"
        >
          Позже
        </button>
        <button
          type="button"
          onClick={() => {
            waiting.postMessage("SKIP_WAITING");
            navigator.serviceWorker.addEventListener("controllerchange", () => {
              window.location.reload();
            });
          }}
          className={`min-h-11 ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
        >
          Обновить
        </button>
      </span>
    </div>
  );
}
