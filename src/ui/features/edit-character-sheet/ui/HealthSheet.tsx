"use client";

import { useState } from "react";

import type { SheetView } from "@/contract/views";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { usePreview } from "@/ui/shared/model/usePreview";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

export function HealthSheet({
  hitPoints,
  onSave,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  hitPoints: SheetView["hitPoints"];
  onSave: (change: { maximumBase: number; masterReduction: number }) => void;
  onCancel: () => void;
}) {
  const [baseText, setBaseText] = useState(String(hitPoints.maximumBase));
  const [masterText, setMasterText] = useState(String(hitPoints.masterReduction));

  const maximumBase = requiredFieldNumber(baseText);
  const masterReduction = requiredFieldNumber(masterText);
  // Незаполненное поле не спрашивают: спрашивать не о чем, пока число не набрано.
  const filled = !Number.isNaN(maximumBase) && !Number.isNaN(masterReduction);
  const preview = usePreview(
    filled ? { kind: "health_preview", maximumBase, masterReduction } : null,
  );
  const effective = preview?.kind === "health_preview" ? preview.effectiveMaximum : null;

  return (
    <EditSheetFrame
      titleRu="Здоровье"
      error={error}
      onCancel={onCancel}
      onSave={() => onSave({ maximumBase, masterReduction })}
    >
      <NumberField labelRu="Базовый максимум" value={baseText} onChange={setBaseText} min={1} />
      <NumberField labelRu="Снижение мастера" value={masterText} onChange={setMasterText} min={0} />

      {/* Снижение кровью ведёт кровавое колдовство: правка руками разошлась бы с почасовым возвратом. */}
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Снижение кровью — {hitPoints.bloodReduction}, возвращается по часу и здесь не правится.
        Действующий максимум станет {effective ?? "—"}.
      </p>
    </EditSheetFrame>
  );
}
