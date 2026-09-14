"use client";

import type { ResourcesView } from "@/contract/views";
import { durationLabel } from "@/ui/entities/spell/lib/format";
import { Sheet } from "@/ui/shared/ui/Sheet";
import { SURFACE_CONTROL, SURFACE_PRIMARY } from "@/ui/shared/ui/surface";

export function AnimalSpeechSheet({
  resources,
  refusalRu,
  onActivate,
  onClose,
}: {
  resources: ResourcesView;
  refusalRu: string | null;
  onActivate: () => void;
  onClose: () => void;
}) {
  const { animalSpeech, runes } = resources;

  return (
    <Sheet
      titleRu={animalSpeech.nameRu}
      footer={
        <>
          <button
            type="button"
            onClick={onActivate}
            className={`min-h-11 ${SURFACE_PRIMARY} px-3 text-sm font-semibold`}
          >
            Активировать
          </button>

          {refusalRu === null ? null : (
            <p role="alert" className="text-xs font-medium text-reaction">
              {refusalRu}
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className={`min-h-11 px-3 text-sm ${SURFACE_CONTROL}`}
          >
            Закрыть
          </button>
        </>
      }
    >
      <p className="text-xs text-ink-quiet">
        {animalSpeech.whereRu} · {durationLabel(animalSpeech.duration)}
      </p>

      <p className="text-sm font-semibold leading-snug">{animalSpeech.effectRu}</p>

      <p className="text-xs leading-normal text-ink-soft">{animalSpeech.noteRu}</p>

      <div className="flex items-center justify-between gap-2 text-sm">
        <span>Осталось рун</span>
        <span className="font-semibold tabular-nums">
          {runes.remaining}/{runes.maximum}
        </span>
      </div>
    </Sheet>
  );
}
