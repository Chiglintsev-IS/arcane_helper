import type { CharacterFields } from "@/core/domain/character/schema";
import { SPELLCASTING_ABILITY } from "@/core/domain/character/spellcasting";

import type { Stat } from "./resolve";
import { abilityStats } from "./stats/abilities";
import { passivePerceptionStat, saveStats, skillStats } from "./stats/checks";
import { armorClassStat } from "./stats/defense";
import { initiativeStat, speedStat } from "./stats/initiative";
import { proficiencyStat } from "./stats/proficiency";
import { spellcastingStats } from "./stats/spellcasting";

export type StatFoundation = Pick<
  CharacterFields,
  "level" | "abilities" | "saveProficiencies" | "skills" | "speed"
>;

export function statsOf(foundation: StatFoundation): readonly Stat[] {
  const abilities = abilityStats(foundation.abilities);
  const proficiency = proficiencyStat(foundation.level);

  const saves = saveStats(abilities, proficiency, foundation.saveProficiencies);
  const skills = skillStats(abilities, proficiency, foundation.skills);
  const spellcasting = spellcastingStats(
    abilities[SPELLCASTING_ABILITY],
    proficiency,
    foundation.level,
  );

  return [
    ...Object.values(abilities),
    proficiency,
    ...Object.values(saves),
    ...Object.values(skills),
    spellcasting.spellSaveDc,
    spellcasting.spellAttackModifier,
    spellcasting.preparedLimit,
    armorClassStat(abilities.dexterity),
    initiativeStat(abilities.dexterity, abilities.wisdom),
    passivePerceptionStat(skills.perception),
    speedStat(foundation.speed),
  ];
}
