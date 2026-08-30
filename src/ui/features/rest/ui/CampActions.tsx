"use client";

import type { RecoveryView } from "@/contract/views";
import { withPlural } from "@/shared/language";
import { ARCANE_RECOVERY_LABEL } from "@/ui/entities/character/lib/labels";
import { RestActionButton } from "./RestActionButton";

function arcaneRecoveryLabel(remaining: number): string {
  return `${ARCANE_RECOVERY_LABEL} · осталось ${withPlural(remaining, ["уровень", "уровня", "уровней"])}`;
}

function disabled(reasonRu: string | undefined): { disabledReason?: string } {
  return reasonRu === undefined ? {} : { disabledReason: reasonRu };
}

export function CampActions({
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
  const { arcaneRecovery } = recovery;

  return (
    <section aria-label="Привал" className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        <RestActionButton
          onClick={onShortRest}
          name={`Короткий отдых · ${recovery.shortRestDurationRu}`}
          {...disabled(recovery.shortRestUnavailabilityRu)}
        />
        <RestActionButton
          onClick={onArcaneRecovery}
          name={arcaneRecoveryLabel(arcaneRecovery.remaining)}
          {...disabled(arcaneRecovery.unavailabilityRu)}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        <RestActionButton
          onClick={onLongRest}
          name="Долгий отдых"
          {...disabled(recovery.longRestUnavailabilityRu)}
        />
      </div>
    </section>
  );
}
