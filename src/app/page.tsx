/**
 * Экран игры — единственный маршрут вехи 1.
 *
 * Страница клиентская целиком: серверных возможностей Next в проекте нет намеренно, а
 * состояние живёт в IndexedDB, до которой сервер не дотянется. Сторы создаются один раз на монтирование
 * и передаются провайдером, поэтому компоненты не знают ни о Dexie, ни о часах.
 */

"use client";

import { useState } from "react";

import { PlayShell } from "@/ui/app/PlayShell";
import { createBrowserStores, StoreProvider } from "@/ui/app/providers/stores";

export default function PlayPage() {
  const [stores] = useState(createBrowserStores);

  return (
    <StoreProvider stores={stores}>
      <PlayShell />
    </StoreProvider>
  );
}
