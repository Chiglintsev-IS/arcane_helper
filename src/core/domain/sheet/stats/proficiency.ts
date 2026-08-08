/**
 * Владение: бонус мастерства.
 *
 * Отдельной величиной, а не числом внутри каждой проверки: его назначают целиком — благословением,
 * даром или словом мастера, — и назначенный обязан дойти до всех спасбросков, навыков, КС и атаки
 * заклинанием разом. Пока он считался у каждого потребителя заново, доходил не до всех.
 */

import { proficiencyBonus } from "@/core/domain/character/abilities";

import { defineStat, ownCandidate, type Stat } from "../resolve";

export function proficiencyStat(level: number): Stat {
  return defineStat({
    id: "proficiencyBonus",
    methods: () => [ownCandidate(proficiencyBonus(level))],
  });
}
