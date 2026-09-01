import type { ResourcesView } from "@/contract/views";

import { LAST_HINT_RU, WARDING_SIGIL_RU } from "@/core/domain/arcana/arcana";
import {
  ANIMAL_SPEECH_DURATION,
  ANIMAL_SPEECH_EFFECT_RU,
  ANIMAL_SPEECH_NOTE_RU,
  ANIMAL_SPEECH_RU,
  ANIMAL_SPEECH_WHERE_RU,
} from "@/core/domain/arcana/runes";
import { slotsInOrder } from "@/core/domain/arcana/slots";
import { Character } from "@/core/domain/assembly/character";
import type { Session } from "@/core/application/session";
import {
  animalSpeechUnavailability,
  wardingSigilAvailable,
} from "@/core/application/useCases/effects";

export function toResourcesView(session: Session): ResourcesView {
  const { character } = session;
  const root = Character.of(character);
  const { runes, lastHint } = root.arcana;
  const unavailabilityRu = animalSpeechUnavailability(session);

  return {
    slots: slotsInOrder(character.spellSlots).map(({ level, remaining, maximum }) => ({
      level,
      remaining,
      maximum,
    })),
    runes: { nameRu: WARDING_SIGIL_RU, remaining: runes.remaining, maximum: runes.maximum },
    lastHint: { nameRu: LAST_HINT_RU, remaining: lastHint.remaining, maximum: lastHint.maximum },
    armorClassAdjustment: root.effects.manualAdjustment("armorAdjustment"),
    passivePerception: root.sheet.value("passivePerception"),
    initiative: root.sheet.value("initiative"),
    wardingSigilAvailable: wardingSigilAvailable(session),
    animalSpeech: {
      nameRu: ANIMAL_SPEECH_RU,
      duration: ANIMAL_SPEECH_DURATION,
      whereRu: ANIMAL_SPEECH_WHERE_RU,
      effectRu: ANIMAL_SPEECH_EFFECT_RU,
      noteRu: ANIMAL_SPEECH_NOTE_RU,
      ...(unavailabilityRu === null ? {} : { unavailabilityRu }),
    },
    suppression: {
      firedUpon: root.vitality.firedUpon,
      underDirectSunlight: character.suppression.underDirectSunlight,
    },
  };
}
