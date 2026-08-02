import type { ActiveEffect, CharacterState } from "@/core/domain/character/state";
import type { Spell } from "@/core/domain/catalog/spell";
import { effectiveDamage } from "@/core/domain/catalog/scaling";
import {
  MINIMUM_CONCENTRATION_DC,
  durationWithRoundsRu,
  startRound,
  type TurnMark,
} from "@/core/domain/effects/concentration";
import { plural, SAVING_THROW_NAMES } from "@/core/shared/language";

const AREA_SHAPES: Record<NonNullable<Spell["area"]>["shape"], string> = {
  cone: "Конус",
  cube: "Куб",
  line: "Линия",
  sphere: "Сфера",
  cylinder: "Цилиндр",
};

/** Способ прерывания концентрации. Право мастера помечено: приложение его не применяет само. */
export type ConcentrationBreaker = {
  textRu: string;
  atDiscretion: boolean;
};

export type ConcentrationSummary = {
  spellId: string;
  nameRu: string;
  slotLabel: string;
  startLabel: string;
  durationLabel: string;
  mechanicsLabel: string;
  breakLabel: string;
  shortRulesRu: string;
  /** Есть ли карточка заклинания в контенте: без неё некуда вести за полными правилами. */
  rulesAvailable: boolean;
  breakers: ConcentrationBreaker[];
};

function signed(value: number): string {
  return value < 0 ? `${value}` : `+${value}`;
}

function feet(value: number): string {
  return `${value} ${plural(value, ["фут", "фута", "футов"])}`;
}

function reachLabel(spell: Spell): string {
  if (spell.area !== undefined) {
    const shape = `${AREA_SHAPES[spell.area.shape]} ${feet(spell.area.sizeFeet)}`;
    return spell.range.type === "self" ? `${shape} от себя` : shape;
  }
  switch (spell.range.type) {
    case "self":
      return "На себя";
    case "touch":
      return "Касание";
    case "distance":
      return feet(spell.range.distanceFeet ?? 0);
    default:
      return "Особая дальность";
  }
}

function resolutionShortRu(spell: Spell, character: CharacterState): string {
  switch (spell.resolution.type) {
    case "spell_attack":
      return `атака заклинанием ${signed(character.spellAttackModifier)}`;
    case "saving_throw":
      return `спасбросок ${SAVING_THROW_NAMES[spell.resolution.savingThrow ?? "CON"]} против КС ${character.spellSaveDc}`;
    default:
      return "без спасброска";
  }
}

function mechanicsRu(spell: Spell, effect: ActiveEffect, character: CharacterState): string {
  const damage =
    spell.damage === undefined
      ? null
      : `урон ${effectiveDamage(spell.damage, {
          spellLevel: spell.level,
          slotLevel: effect.slotLevelUsed,
          characterLevel: character.level,
        })} (${spell.damage.type})`;

  return [reachLabel(spell), resolutionShortRu(spell, character), damage]
    .filter((part) => part !== null)
    .join(" · ");
}

function breakers(constitutionModifier: string): ConcentrationBreaker[] {
  return [
    {
      textRu: `Урон — спасбросок Телосложения ${constitutionModifier}, КС = максимум(${MINIMUM_CONCENTRATION_DC}, половина урона вниз). Провал завершает и концентрацию, и эффект`,
      atDiscretion: false,
    },
    { textRu: "Ещё одно концентрационное заклинание — это заменит", atDiscretion: false },
    { textRu: "Недееспособность или смерть", atDiscretion: false },
    { textRu: "Своё решение — в любой момент, бесплатно", atDiscretion: false },
    { textRu: "Истечение длительности — приложение не отсчитывает", atDiscretion: false },
    {
      textRu: `Сильно отвлекающая обстановка — спасбросок Телосложения ${constitutionModifier} против КС ${MINIMUM_CONCENTRATION_DC}`,
      atDiscretion: true,
    },
  ];
}

/**
 * Описание собирается из карточки при отрисовке, а не хранится: сохранённый текст разошёлся бы с
 * обновлённым контентом. Карточки может не быть — состояние пришло импортом из другой сборки, — и
 * тогда описание деградирует до того, что лежит в самом эффекте: концентрация не может исчезнуть с
 * экрана незаметно.
 */
export function describeConcentration(input: {
  spell: Spell | null;
  effect: ActiveEffect;
  character: CharacterState;
  journal: readonly TurnMark[];
}): ConcentrationSummary {
  const { spell, effect, character, journal } = input;
  const start = startRound(journal, effect.startedAt);
  const modifier = signed(character.constitutionSaveModifier);

  return {
    spellId: effect.spellId,
    nameRu: effect.nameRu,
    slotLabel: effect.slotLevelUsed === 0 ? "без ячейки" : `ячейка ${effect.slotLevelUsed} ур.`,
    startLabel: start.approximate ? `раунд ≥ ${start.round}` : `раунд ${start.round}`,
    durationLabel: durationWithRoundsRu(effect.duration),
    mechanicsLabel:
      spell === null
        ? "Правил нет в контенте: состояние из другой сборки"
        : mechanicsRu(spell, effect, character),
    breakLabel: `Урон → спасбросок Телосложения ${modifier}, КС от ${MINIMUM_CONCENTRATION_DC}`,
    shortRulesRu: spell === null ? effect.endConditionRu : spell.shortRulesRu,
    rulesAvailable: spell !== null,
    breakers: breakers(modifier),
  };
}
