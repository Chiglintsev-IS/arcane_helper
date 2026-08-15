/**
 * Проверки: спасброски, навыки и пассивная внимательность.
 *
 * Одна ответственность на все три, потому что правило у них одно — характеристика плюс владение, —
 * и расходиться им нечем. Пассивная внимательность стоит здесь же: это не отдельная формула, а
 * навык, который не бросают.
 */

import {
  passivePerception,
  savingThrowModifier,
  skillModifier,
} from "@/core/domain/character/abilities";
import { SKILL_ABILITY, type SkillTraining } from "@/core/domain/character/skills";
import { recordOf } from "@/core/domain/shared/records";
import {
  ABILITIES,
  SKILL_IDS,
  saveStatId,
  skillStatId,
  type Ability,
  type SkillId,
} from "@/core/domain/shared/stats";

import { defineStat, ownCandidate, type Stat } from "../resolve";

export function saveStats(
  abilities: Readonly<Record<Ability, Stat>>,
  proficiency: Stat,
  proficient: readonly Ability[],
): Readonly<Record<Ability, Stat>> {
  return recordOf(ABILITIES, (ability) =>
    defineStat({
      id: saveStatId(ability),
      from: [abilities[ability], proficiency],
      methods: (read) => [
        ownCandidate(
          savingThrowModifier({
            score: read(abilities[ability]),
            proficient: proficient.includes(ability),
            proficiencyBonus: read(proficiency),
          }),
        ),
      ],
    }),
  );
}

export function skillStats(
  abilities: Readonly<Record<Ability, Stat>>,
  proficiency: Stat,
  training: Readonly<Partial<Record<SkillId, SkillTraining>>>,
): Readonly<Record<SkillId, Stat>> {
  return recordOf(SKILL_IDS, (skill) =>
    defineStat({
      id: skillStatId(skill),
      from: [abilities[SKILL_ABILITY[skill]], proficiency],
      methods: (read) => [
        ownCandidate(
          skillModifier({
            score: read(abilities[SKILL_ABILITY[skill]]),
            training: training[skill],
            proficiencyBonus: read(proficiency),
          }),
        ),
      ],
    }),
  );
}

/** Пассивная внимательность: десятка плюс действующая Внимательность — со всем, что принесли. */
export function passivePerceptionStat(perception: Stat): Stat {
  return defineStat({
    id: "passivePerception",
    from: [perception],
    methods: (read) => [ownCandidate(passivePerception(read(perception)))],
  });
}
