"use client";

import { useState } from "react";

import type { ChoicesView, SheetView } from "@/contract/views";
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
  contribution: { stat: string; kind: "assignment" | "bonus"; value: number };
};

export function PermanentContributionSheet({
  contributions,
  choices,
  editing = null,
  onSave,
  onRemove,
  onCancel,
  error = null,
}: {
  /** Постоянные вклады как они стоят на листе: начальные значения полей. */
  contributions: SheetView["permanentContributions"];
  /** Из чего выбирают: перечень величин правилами и назван, и упорядочен. */
  choices: ChoicesView;
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
  // Новый вклад начинает с первой предложенной величины: перечень назван правилами, и своего
  // умолчания у шторки нет.
  const [stat, setStat] = useState(known?.stat ?? choices.stats[0]?.id ?? "");
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
          onChange={(event) => setStat(event.target.value)}
          className="min-h-11 rounded-xl border border-slate-200 bg-transparent px-3 dark:border-slate-800"
        >
          {choices.stats.map((option) => (
            <option key={option.id} value={option.id}>
              {statLabel(choices.stats, option.id)}
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
