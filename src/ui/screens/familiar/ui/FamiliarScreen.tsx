"use client";

import { useSession } from "@/ui/shared/model/storeContext";

import { FamiliarCard } from "@/ui/widgets/familiar/ui/FamiliarCard";

const SCREEN_LABEL = "Фамильяр";

export function FamiliarScreen() {
  const snapshot = useSession((state) => state.snapshot)!;

  /*
   Нажимать здесь нечего: экран только читают. Область прокрутки без фокусируемого содержимого
   недостижима с клавиатуры в Safari — потому фокус берёт на себя она сама.
   */
  return (
    <div
      role="region"
      aria-label={SCREEN_LABEL}
      tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2"
    >
      <FamiliarCard familiar={snapshot.familiar} />
    </div>
  );
}
