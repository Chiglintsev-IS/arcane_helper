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

import type { SheetView } from "@/contract/views";

import { Character } from "@/core/domain/assembly/character";
import type { CharacterState } from "@/core/domain/assembly/state";
import { skillsOfAbility } from "@/core/domain/character/skills";
import { ABILITIES, abilityStatId, saveStatId, skillStatId } from "@/core/domain/shared/stats";
import { Vitality } from "@/core/domain/vitality/vitality";

export function toSheetView(character: CharacterState): SheetView {
  const sheet = Character.of(character).sheet;
  const vitality = Vitality.of(character);
  const { hitDice } = character;

  return {
    name: character.name,
    species: character.species,
    age: character.age,
    size: character.size,
    speed: sheet.value("speed"),
    speedBase: character.speed,
    className: character.className,
    level: character.level,
    subclass: character.subclass,

    hitPoints: {
      current: vitality.current,
      maximum: vitality.maximum,
      maximumBase: vitality.maximumBase,
      bloodReduction: vitality.bloodReduction,
      masterReduction: vitality.masterReduction,
      maximumReduction: vitality.maximumReduction,
      temporary: vitality.temporary,
      ...(hitDice === undefined
        ? {}
        : { hitDice: { remaining: hitDice.remaining, total: hitDice.total, size: hitDice.size } }),
    },

    armorClass: sheet.value("armorClass"),

    exhaustion: character.exhaustion,
    inspiration: character.inspiration,

    proficiencyBonus: sheet.value("proficiencyBonus"),

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

    features: character.features.map((feature) => ({
      nameRu: feature.nameRu,
      summaryRu: feature.summaryRu,
    })),
  };
}
