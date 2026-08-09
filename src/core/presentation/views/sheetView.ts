/**
 * Проекция листа персонажа: база и всё, что из неё следует, посчитанным.
 *
 * Свёртку зовут здесь один раз на величину и отдают числом. Пока лист ездил наружу состоянием,
 * каждый показывающий звал свёртку сам, и «спросить у правил» превращалось в «повторить правила у
 * себя» на первом же экране, которому понадобилось то же число в другом месте.
 *
 * Подписей здесь нет: род вклада, имя характеристики и степень владения уезжают словами правил, а
 * называет их показывающий. Слово, придуманное здесь, стало бы вторым именем той же вещи.
 */

import type { ContributionView, SheetView, StatView } from "@/contract/views";

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { skillsOfAbility } from "@/core/domain/character/skills";
import type { Sheet } from "@/core/domain/sheet/sheet";
import {
  ABILITIES,
  abilityStatId,
  saveStatId,
  skillStatId,
  type StatContribution,
  type StatId,
} from "@/core/domain/shared/stats";
import { Vitality } from "@/core/domain/vitality/vitality";

/** На сколько вклад двигает величину: у способа счёта это его основание. */
function contributionValue(contribution: StatContribution): number {
  return contribution.kind === "method" ? contribution.method.base : contribution.value;
}

/**
 * Величина с разбором. В разбор идёт только принятое: отвергнутый вклад отвечает на вопрос,
 * которого за столом не задают, а строку на узком экране занимает.
 */
function statView(sheet: Sheet, stat: StatId): StatView {
  const breakdown = sheet.breakdown(stat);
  return {
    value: breakdown.value,
    parts: breakdown.parts
      .filter((part) => part.applied)
      .map((part) => ({
        nameRu: part.source.nameRu,
        kind: part.contribution.kind,
        value: contributionValue(part.contribution),
      })),
  };
}

function permanentViews(
  character: CharacterState,
): readonly (ContributionView & { stat: string })[] {
  return character.permanentContributions.map(({ nameRu, contribution }) => ({
    nameRu,
    stat: contribution.stat,
    kind: contribution.kind,
    value: contributionValue(contribution),
  }));
}

export function toSheetView(character: CharacterState): SheetView {
  const sheet = Character.of(character).sheet;
  const vitality = Vitality.of(character);
  const { hitDice } = character;

  return {
    name: character.name,
    species: character.species,
    age: character.age,
    size: character.size,
    speed: character.speed,
    className: character.className,
    level: character.level,
    subclass: character.subclass,

    hitPoints: {
      current: vitality.current,
      maximum: vitality.maximum,
      maximumBase: vitality.maximumBase,
      bloodReduction: vitality.bloodReduction,
      masterReduction: vitality.masterReduction,
      temporary: vitality.temporary,
      ...(hitDice === undefined
        ? {}
        : { hitDice: { remaining: hitDice.remaining, total: hitDice.total, size: hitDice.size } }),
    },

    armorClass: statView(sheet, "armorClass"),

    exhaustion: character.exhaustion,
    inspiration: character.inspiration,

    permanentContributions: [...permanentViews(character)],

    abilities: ABILITIES.map((ability) => ({
      id: ability,
      score: sheet.value(abilityStatId(ability)),
      modifier: sheet.abilityModifier(ability),
      save: sheet.value(saveStatId(ability)),
      saveProficient: character.saveProficiencies.includes(ability),
      skills: skillsOfAbility(ability).map((skill) => {
        const training = character.skills[skill];
        return {
          id: skill,
          value: sheet.value(skillStatId(skill)),
          ...(training === undefined ? {} : { training }),
        };
      }),
    })),

    proficiencies: {
      weapons: [...character.proficiencies.weapons],
      armor: [...character.proficiencies.armor],
      tools: [...character.proficiencies.tools],
      languages: [...character.proficiencies.languages],
    },
  };
}
