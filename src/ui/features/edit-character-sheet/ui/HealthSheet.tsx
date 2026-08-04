"use client";

import { useState } from "react";

import type { CharacterState } from "@/core/domain/assembly/state";
import { Vitality } from "@/core/domain/vitality/vitality";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

export function HealthSheet({
  character,
  onSave,
  onCancel,
  error = null,
}: {
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  character: CharacterState;
  onSave: (change: { maximumBase: number; masterReduction: number }) => void;
  onCancel: () => void;
}) {
  const { hitPoints } = character;
  const [baseText, setBaseText] = useState(String(hitPoints.maximumBase));
  const [masterText, setMasterText] = useState(String(hitPoints.masterReduction));

  const maximumBase = requiredFieldNumber(baseText);
  const masterReduction = requiredFieldNumber(masterText);
  // Каким станет действующий максимум, знает жизнеспособность; `null` — такого максимума не бывает.
  const effective = Vitality.of(character).maximumWith({ maximumBase, masterReduction });

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
