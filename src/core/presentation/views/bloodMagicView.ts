/**
 * Проекция кровавого колдовства: во что обходится очко и сколько их берут за раз.
 *
 * Стоит отдельно от ресурсов потому, что описывает не остаток, а обмен: курс ступени, границы
 * одной сделки и то, что этой сделке сейчас мешает. Остаток очков сюда не повторяется — его несут
 * ресурсы, и второе такое же число разошлось бы с первым молча.
 *
 * Помехи приходят от той же проверки, которой откажет подтверждение: строка списка и мастер обмена
 * обязаны называть один запрет одними словами, иначе игрок читает их как два разных.
 */

import type { BloodMagicView } from "@/contract/views";

import {
  ascensionTierRate,
  maximumExchangePoints,
  spellPointCost,
  MINIMUM_EXCHANGE_POINTS,
  MINIMUM_SPELL_LEVEL,
} from "@/core/domain/arcana/slots";
import { exchangeWarnings } from "@/core/application/casting/availability";
import type { Session } from "@/core/application/session";
import { deriveTurnEconomy } from "@/core/application/useCases/turn";

/**
 * С какого числа очков открывается мастер: со стоимости самого дешёвого заклинания.
 *
 * Одно очко не покупает ничего, а начинать с потолка значило бы предлагать отдать всё здоровье.
 * Потолок обмена ниже этого числа, когда хитов почти не осталось, — тогда предлагается он.
 */
function initialPoints(maximum: number): number {
  return Math.min(spellPointCost(MINIMUM_SPELL_LEVEL), maximum);
}

export function toBloodMagicView(session: Session): BloodMagicView {
  const { character } = session;
  const maximum = maximumExchangePoints(character.hitPoints.current, character.level);

  return {
    hitPointsPerPoint: ascensionTierRate(character.level),
    points: {
      minimum: MINIMUM_EXCHANGE_POINTS,
      maximum,
      initial: initialPoints(maximum),
    },
    warningsRu: exchangeWarnings(character, deriveTurnEconomy(session)),
  };
}
