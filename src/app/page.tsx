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
