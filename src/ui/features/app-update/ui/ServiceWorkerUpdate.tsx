/**
 * Регистрация service worker и предложение обновиться.
 *
 * Обновление не применяется молча: незапрошенная перезагрузка посреди мастера применения потеряет
 * черновик, а посреди боя — внимание игрока. Новая версия ждёт в стороне, пока её не позовут.
 *
 * Проверка обновлений никогда не блокирует запуск: без сети регистрация просто не удаётся, и
 * приложение продолжает работать на прежней версии.
 *
 * Места на экране полоса себе не берёт: где стоят полосы оболочки, решает оболочка. Прикреплённая
 * к нижнему краю экрана, она накрыла бы панель режимов, а другой навигации в приложении нет.
 */

"use client";

import { useEffect, useState } from "react";
import { SURFACE_PANEL } from "@/ui/shared/ui/surface";

export function ServiceWorkerUpdate() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [postponed, setPostponed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const watch = (candidate: ServiceWorkerRegistration): void => {
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
  }, []);

  if (waiting === null || postponed) return null;

  return (
    <div
      role="status"
      className={`flex items-center justify-between gap-2 rounded-lg p-2 text-sm ${SURFACE_PANEL}`}
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
            // Перезагрузка после смены управляющего работника: иначе часть страницы осталась бы от
            // прежней версии.
            navigator.serviceWorker.addEventListener("controllerchange", () => {
              window.location.reload();
            });
          }}
          className="min-h-11 rounded-xl bg-action-strong px-3 text-sm font-semibold text-white"
        >
          Обновить
        </button>
      </span>
    </div>
  );
}
