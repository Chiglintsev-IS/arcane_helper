"use client";

import { useSession } from "@/ui/shared/model/storeContext";
import { SURFACE_GROUP } from "@/ui/shared/ui/surface";

const AWAITING_RU = "Здесь встанет верстак, когда мастер назовёт правила.";

export function SmithingScreen() {
  const snapshot = useSession((state) => state.snapshot)!;
  const { smithing } = snapshot.crafting;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2">
      <div className={`flex flex-col gap-1 p-3 ${SURFACE_GROUP}`}>
        <h2 className="text-base font-semibold leading-tight">{smithing.nameRu}</h2>
        <p className="text-xs leading-snug text-ink-quiet">{smithing.noteRu}</p>
        <p className="mt-1 text-xs leading-snug text-ink-quiet">{AWAITING_RU}</p>
      </div>
    </div>
  );
}
