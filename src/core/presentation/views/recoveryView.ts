/**
 * Проекция восстановления: что вернут час и конец боя и что мешает начать.
 *
 * Кнопка обещает числа заранее: назвать случившееся после нажатия значит назвать его поздно. Числа
 * те же, что применит сама операция: спрошены у владельца правил, а не пересчитаны показывающим.
 */

import type { RecoveryView } from "@/contract/views";

import { Character } from "@/core/domain/assembly/character";
import type { Session } from "@/core/application/session";
import { hourUnavailability } from "@/core/application/useCases/health";
import { recoverableSlots } from "@/core/domain/arcana/slots";
import { SHORT_REST_DURATION_RU } from "@/core/domain/vitality/shortRest";
import {
  arcaneRecoveryUnavailability,
  longRestUnavailability,
  shortRestUnavailability,
} from "@/core/application/useCases/rest";
import { combatEndRecovery } from "@/core/application/useCases/turn";

export function toRecoveryView(session: Session): RecoveryView {
  const { character } = session;
  const root = Character.of(character);
  const { returned, healed } = root.vitality.afterAnHour(root.base.level);

  const hour = hourUnavailability(session);
  const shortRest = shortRestUnavailability(session);
  const longRest = longRestUnavailability(session);
  const recovery = arcaneRecoveryUnavailability(session);

  return {
    nextHour: {
      maximumReturned: returned,
      healed,
      ...(hour === null ? {} : { unavailabilityRu: hour }),
    },
    combatEndRecovery: combatEndRecovery(character),
    shortRestDurationRu: SHORT_REST_DURATION_RU,
    ...(shortRest === null ? {} : { shortRestUnavailabilityRu: shortRest }),
    ...(longRest === null ? {} : { longRestUnavailabilityRu: longRest }),
    arcaneRecovery: {
      remaining: character.arcaneRecovery.remaining,
      ...(recovery === null ? {} : { unavailabilityRu: recovery }),
      recoverable: recoverableSlots(character.spellSlots).map((slot) => ({
        level: slot.level,
        spent: slot.spent,
      })),
    },
  };
}
