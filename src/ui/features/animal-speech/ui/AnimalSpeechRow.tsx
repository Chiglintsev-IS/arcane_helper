import type { ResourcesView } from "@/contract/views";
import { combatRole, durationLabel } from "@/ui/entities/spell/lib/format";
import { animalSpeechTraits } from "@/ui/shared/model/actionTraits";
import { ActionRow } from "@/ui/shared/ui/ActionRow";

export function AnimalSpeechRow({
  resources,
  onOpen,
}: {
  resources: ResourcesView;
  onOpen: () => void;
}) {
  const { animalSpeech, runes } = resources;

  return (
    <ActionRow
      nameRu={animalSpeech.nameRu}
      role={combatRole(animalSpeechTraits(animalSpeech.nameRu).role)}
      onOpen={onOpen}
    >
      <span className="flex w-full items-baseline justify-between gap-3 text-[0.84375rem]">
        <span className="whitespace-nowrap text-ink-quiet">
          руна {runes.remaining}/{runes.maximum}
        </span>
        <span className="shrink-0 font-semibold text-ink-soft">
          {durationLabel(animalSpeech.duration)}
        </span>
      </span>

      <span className="text-[0.78125rem] text-ink-quiet">{animalSpeech.whereRu}</span>

      <span className="text-sm font-bold leading-snug text-ink">{animalSpeech.effectRu}</span>

      <span className="text-[0.78125rem] leading-normal text-ink-quiet">{animalSpeech.noteRu}</span>

      {animalSpeech.unavailabilityRu === undefined ? null : (
        <span className="text-xs font-medium text-reaction">{animalSpeech.unavailabilityRu}</span>
      )}
    </ActionRow>
  );
}
