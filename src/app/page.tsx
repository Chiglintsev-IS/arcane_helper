/**
 * Экран боя — единственный маршрут веха 1.
 *
 * Страница клиентская целиком: серверных возможностей Next в проекте нет намеренно, а
 * состояние живёт в IndexedDB, до которой сервер не дотянется. Сторы создаются один раз на монтирование
 * и передаются провайдером, поэтому компоненты не знают ни о Dexie, ни о часах.
 */

"use client";

import { useState } from "react";

import { CombatScreen } from "@/ui/screens/combat/ui/CombatScreen";
import { createBrowserStores, StoreProvider } from "@/ui/app/providers/stores";

export default function CombatPage() {
  const [stores] = useState(createBrowserStores);

  return (
    <StoreProvider stores={stores}>
      <CombatScreen />
    </StoreProvider>
  );
}
