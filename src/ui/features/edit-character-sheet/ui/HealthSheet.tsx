"use client";

import { useState } from "react";

import type { CharacterState } from "@/core/domain/character/state";
import { EditSheetFrame, NumberField } from "./EditSheetFrame";

export function HealthSheet({
  character,
  onSave,
  onCancel,
}: {
  character: CharacterState;
  onSave: (change: { maximumBase: number; masterReduction: number }) => void;
  onCancel: () => void;
}) {
  const { hitPoints } = character;
  const [baseText, setBaseText] = useState(String(hitPoints.maximumBase));
  const [masterText, setMasterText] = useState(String(hitPoints.masterReduction));

  const maximumBase = Number.parseInt(baseText, 10);
  const masterReduction = Number.parseInt(masterText, 10);
  const both = Number.isInteger(maximumBase) && Number.isInteger(masterReduction);
  const effective = maximumBase - hitPoints.bloodReduction - masterReduction;
  const valid = both && maximumBase > 0 && masterReduction >= 0 && effective > 0;

  return (
    <EditSheetFrame
      titleRu="Здоровье"
      canSave={valid}
      onCancel={onCancel}
      onSave={() => onSave({ maximumBase, masterReduction })}
    >
      <NumberField labelRu="Базовый максимум" value={baseText} onChange={setBaseText} min={1} />
      <NumberField labelRu="Снижение мастера" value={masterText} onChange={setMasterText} min={0} />

      {/* Снижение кровью ведёт кровавое колдовство: правка руками разошлась бы с почасовым возвратом. */}
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Снижение кровью — {hitPoints.bloodReduction}, возвращается по часу и здесь не правится.
        Действующий максимум станет {both ? effective : "—"}.
      </p>
    </EditSheetFrame>
  );
}
