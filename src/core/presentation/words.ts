/**
 * Сужение внешнего языка до внутреннего: строка договора — в слово правил и в карточку каталога.
 *
 * Стоит отдельно от контроллера потому, что сужают обе входящие двери: команда меняет состояние,
 * вопрос только спрашивает, а слово «руна» обязано означать одно и то же в обеих. Вторая копия
 * сужения приняла бы то, чего владелец списка уже не принимает, — и молча.
 */

import { DomainError } from "@/core/domain/shared/errors";
import { CAST_MODES, type CastMode } from "@/core/domain/arcana/slots";
import { RUNES, type Rune } from "@/core/domain/arcana/runes";
import {
  ALCHEMICAL_RARITIES,
  ALCHEMY_DIRECTIONS,
  type AlchemyDirection,
} from "@/core/domain/catalog/alchemy";
import type { RevealedProperty } from "@/core/domain/crafting/schema";
import type { Spell } from "@/core/domain/catalog/spell";

/**
 * Слово из закрытого списка. Список приносит его владелец — тот самый, которым пользуется он сам,
 * поэтому пополнение перечня доходит сюда без правок.
 */
export function oneOf<TWord extends string>(
  words: readonly TWord[],
  value: string,
  subject: string,
): TWord {
  const found = words.find((word) => word === value);
  if (found === undefined) {
    throw new DomainError(`Не годится ${subject} — «${value}» не из тех, что бывают`);
  }
  return found;
}

/** Слова, которые спрашивают обе двери: и команда сотворения, и вопрос про набранное. */
export function castModeOf(value: string): CastMode {
  return oneOf(CAST_MODES, value, "способ сотворения");
}

export function runeOf(value: string): Rune {
  return oneOf(RUNES, value, "руна");
}

/** Слова алхимии, которыми игрок называет работу до того, как за неё возьмётся. */
export function directionOf(value: string): AlchemyDirection {
  return oneOf(ALCHEMY_DIRECTIONS, value, "направление алхимии");
}

export function rarityOf(value: string): RevealedProperty["rarity"] {
  return oneOf(ALCHEMICAL_RARITIES, value, "редкость свойства");
}

/** Карточка по идентификатору: сообщение называет заклинание, карточку ядро берёт свою. */
export function spellOf(catalog: readonly Spell[], spellId: string): Spell {
  const spell = catalog.find((candidate) => candidate.id === spellId);
  if (spell === undefined) {
    throw new DomainError(`Не годится заклинание — карточки «${spellId}» в каталоге нет`);
  }
  return spell;
}
