"use client";

import type { RecoveryView } from "@/contract/views";
import { CampActions } from "@/ui/features/rest/ui/CampActions";

export function Camp({
  recovery,
  onShortRest,
  onLongRest,
  onArcaneRecovery,
}: {
  recovery: RecoveryView;
  onShortRest: () => void;
  onLongRest: () => void;
  onArcaneRecovery: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <CampActions
        recovery={recovery}
        onShortRest={onShortRest}
        onLongRest={onLongRest}
        onArcaneRecovery={onArcaneRecovery}
      />
    </div>
  );
}
