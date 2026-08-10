/**
 * Экран игры — единственная страница приложения.
 *
 * Страница клиентская целиком: состоянием владеет ядро — своё в процессе или бэкенда, — и до него
 * дотягивается композиционный корень, а не она. Сторы создаются один раз на монтирование и
 * передаются провайдером, поэтому компоненты не знают ни о проводе, ни о хранилище.
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
