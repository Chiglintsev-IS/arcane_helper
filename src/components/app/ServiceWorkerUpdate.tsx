/**
 * Регистрация service worker и предложение обновиться (F-12, NFR-001, NFR-003).
 *
 * Обновление не применяется молча: незапрошенная перезагрузка посреди мастера применения потеряет
 * черновик, а посреди боя — внимание игрока. Новая версия ждёт в стороне, пока её не позовут.
 *
 * Проверка обновлений никогда не блокирует запуск: без сети регистрация просто не удаётся, и
 * приложение продолжает работать на прежней версии.
 */

"use client";

import { useEffect, useState } from "react";

export function ServiceWorkerUpdate() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;
    const watch = (candidate: ServiceWorkerRegistration): void => {
      registration = candidate;
      if (candidate.waiting !== null) setWaiting(candidate.waiting);
      candidate.addEventListener("updatefound", () => {
        const installing = candidate.installing;
        if (installing === null) return;
        installing.addEventListener("statechange", () => {
          // Новая версия готова, а прежняя ещё управляет страницей — значит, есть что предложить.
          if (installing.state === "installed" && navigator.serviceWorker.controller !== null) {
            setWaiting(installing);
          }
        });
      });
    };

    void navigator.serviceWorker.register("./sw.js").then(watch, () => {
      // Регистрация не удалась — приложение работает как обычная страница. Это не ошибка,
      // о которой стоит сообщать: офлайна просто не будет до следующего удачного запуска.
    });

    return () => {
      registration = null;
    };
  }, []);

  if (waiting === null) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-800 dark:bg-slate-950"
    >
      <span>Готово обновление приложения.</span>
      <button
        type="button"
        onClick={() => {
          waiting.postMessage("SKIP_WAITING");
          // Перезагрузка после смены управляющего работника: иначе часть страницы осталась бы от
          // прежней версии.
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            window.location.reload();
          });
        }}
        className="min-h-11 shrink-0 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white"
      >
        Обновить
      </button>
    </div>
  );
}
