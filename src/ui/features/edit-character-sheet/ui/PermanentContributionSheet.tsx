"use client";

import { useState } from "react";

import type { SheetView } from "@/contract/views";
import { STAT_IDS, type StatId } from "@/core/domain/shared/stats";
import { requiredFieldNumber } from "@/ui/shared/lib/fieldNumber";
import { statLabel } from "@/ui/entities/character/lib/labels";
import { EditSheetFrame, NumberField, TextField } from "./EditSheetFrame";

/**
 * Постоянный вклад персонажа: раса, дар, благословение, слово мастера — то, у чего нет ни вещи, ни
 * срока.
 *
 * Одна шторка вместо четырёх. Прежде отдельно набирали перебивку числа, перебивку базы защиты и
 * прочие прибавки, и у каждой была своя математика — а за столом это одно и то же действие: назвать
 * величину, назвать число и сказать, откуда оно.
 *
 * Границ нет: проклятие — тоже вклад, и его число отрицательно. Вклады надетых вещей сюда не
 * входят — они приходят из инвентаря и правятся у самой вещи в «Сумке».
 */
/** Вклад так, как его набирают: откуда он, какую величину двигает и на сколько. */
type PermanentContributionPatch = {
  nameRu: string;
  contribution: { stat: StatId; kind: "assignment" | "bonus"; value: number };
};

export function PermanentContributionSheet({
  contributions,
  editing = null,
  onSave,
  onRemove,
  onCancel,
  error = null,
}: {
  /** Постоянные вклады как они стоят на листе: начальные значения полей. */
  contributions: SheetView["permanentContributions"];
  /** Имя правимого вклада; `null` — заводится новый. */
  editing?: string | null;
  /** Причина отказа от владельца: почему набранное не сохранилось. */
  error?: string | null;
  onSave: (permanent: PermanentContributionPatch) => void;
  onRemove: (nameRu: string) => void;
  onCancel: () => void;
}) {
  const known = contributions.find((entry) => entry.nameRu === editing);

  const [nameRu, setNameRu] = useState(known?.nameRu ?? "");
  const [stat, setStat] = useState<StatId>(statOf(known?.stat ?? "armorClass"));
  const [assigns, setAssigns] = useState(known?.kind === "assignment");
  const [value, setValue] = useState(String(known?.value ?? 0));

  const number = requiredFieldNumber(value);

  return (
    <EditSheetFrame
      titleRu={known === undefined ? "Новый постоянный вклад" : known.nameRu}
      error={error}
      onCancel={onCancel}
      onSave={() =>
        onSave({
          nameRu,
          contribution: assigns
            ? { stat, kind: "assignment", value: number }
            : { stat, kind: "bonus", value: number },
        })
      }
    >
      <TextField labelRu="Откуда" value={nameRu} onChange={setNameRu} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-slate-500 dark:text-slate-400">Величина</span>
        <select
          value={stat}
          onChange={(event) => setStat(statOf(event.target.value))}
          className="min-h-11 rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-800"
        >
          {STAT_IDS.map((id) => (
            <option key={id} value={id}>
              {statLabel(id)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={assigns}
          onChange={(event) => setAssigns(event.target.checked)}
        />
        Величина равна этому числу, а не прибавляется на него
      </label>

      <NumberField labelRu="Число" value={value} onChange={setValue} />

      {known === undefined ? null : (
        <button
          type="button"
          onClick={() => onRemove(known.nameRu)}
          className="min-h-11 rounded-xl border border-reaction px-3 text-sm"
        >
          Снять вклад
        </button>
      )}
    </EditSheetFrame>
  );
}

/** Выбранное в списке — величина словаря: список из него и построен. */
function statOf(chosen: string): StatId {
  return STAT_IDS.find((id) => id === chosen) ?? "armorClass";
}
