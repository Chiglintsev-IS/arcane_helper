/**
 * Инициатива и скорость: то, чем персонаж входит в бой и движется по нему.
 */

import { initiativeModifier } from "@/core/domain/character/abilities";

import { defineStat, ownCandidate, type Stat } from "../resolve";

export function initiativeStat(dexterity: Stat, wisdom: Stat): Stat {
  return defineStat({
    id: "initiative",
    from: [dexterity, wisdom],
    methods: (read) => [
      ownCandidate(
        initiativeModifier({ dexterity: read(dexterity), wisdom: read(wisdom) }),
      ),
    ],
  });
}

/** Скорость: назад персонаж не ходит, поэтому ниже нуля величина не опускается. */
export function speedStat(feet: number): Stat {
  return defineStat({
    id: "speed",
    range: { minimum: 0 },
    methods: () => [ownCandidate(feet)],
  });
}
