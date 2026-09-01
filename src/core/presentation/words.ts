import { DomainError } from "@/core/domain/shared/errors";
import { CAST_MODES, type CastMode } from "@/core/domain/arcana/slots";
import { RUNES, type Rune } from "@/core/domain/arcana/runes";
import {
  ALCHEMICAL_RARITIES,
  ALCHEMY_DIRECTIONS,
  type AlchemicalRarity,
  type AlchemyDirection,
} from "@/core/domain/catalog/alchemy";
import type { Spell } from "@/core/domain/catalog/spell";

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

export function castModeOf(value: string): CastMode {
  return oneOf(CAST_MODES, value, "способ сотворения");
}

export function runeOf(value: string): Rune {
  return oneOf(RUNES, value, "руна");
}

export function directionOf(value: string): AlchemyDirection {
  return oneOf(ALCHEMY_DIRECTIONS, value, "направление алхимии");
}

export function rarityOf(value: string): AlchemicalRarity {
  return oneOf(ALCHEMICAL_RARITIES, value, "редкость свойства");
}

export function spellOf(catalog: readonly Spell[], spellId: string): Spell {
  const spell = catalog.find((candidate) => candidate.id === spellId);
  if (spell === undefined) {
    throw new DomainError(`Не годится заклинание — карточки «${spellId}» в каталоге нет`);
  }
  return spell;
}
