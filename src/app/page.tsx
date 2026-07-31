/**
 * Экран боя — единственный маршрут веха 1 ([F-01](../../docs/features/F-01-combat-screen.md)).
 *
 * Страница клиентская целиком: серверных возможностей Next в проекте нет намеренно (ADR-0002), а
 * состояние живёт в IndexedDB, до которой сервер не дотянется. Сторы создаются один раз на монтирование
 * и передаются провайдером, поэтому компоненты не знают ни о Dexie, ни о часах.
 */

"use client";

import { useState } from "react";

import { CombatScreen } from "@/components/combat/CombatScreen";
import { createBrowserStores, StoreProvider } from "@/store/provider";

export default function CombatPage() {
  const [stores] = useState(createBrowserStores);

  return (
    <StoreProvider stores={stores}>
      <CombatScreen />
    </StoreProvider>
  );
}
