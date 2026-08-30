import { DomainError } from "@/core/domain/shared/errors";
import { MAXIMUM_CHARACTER_LEVEL, MINIMUM_CHARACTER_LEVEL } from "@/core/domain/shared/levels";

import type { SkillTraining } from "./skills";

export const MINIMUM_ABILITY_SCORE = 1;
export const MAXIMUM_ABILITY_SCORE = 30;

export const MAXIMUM_EXHAUSTION = 6;
export const EXHAUSTION_STEPS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

const SAVE_DC_BASE = 8;

function assertCharacterLevel(level: number): void {
  if (!Number.isInteger(level) || level < MINIMUM_CHARACTER_LEVEL || level > MAXIMUM_CHARACTER_LEVEL) {
    throw new DomainError(
      `Уровень персонажа должен быть целым от ${MINIMUM_CHARACTER_LEVEL} до ${MAXIMUM_CHARACTER_LEVEL}, получено: ${level}`,
    );
  }
}

export function proficiencyBonus(level: number): number {
  assertCharacterLevel(level);
  return 2 + Math.floor((level - 1) / 4);
}

export function abilityModifier(score: number): number {
  if (!Number.isInteger(score)) {
    throw new DomainError(`Значение характеристики должно быть целым, получено: ${score}`);
  }
  return Math.floor((score - 10) / 2);
}

export function spellSaveDc(input: {
  proficiencyBonus: number;
  score: number;
}): number {
  return SAVE_DC_BASE + input.proficiencyBonus + abilityModifier(input.score);
}

export function spellAttackModifier(input: {
  proficiencyBonus: number;
  score: number;
}): number {
  return input.proficiencyBonus + abilityModifier(input.score);
}

export function savingThrowModifier(input: {
  score: number;
  proficient: boolean;
  proficiencyBonus: number;
}): number {
  return (
    abilityModifier(input.score) + (input.proficient ? input.proficiencyBonus : 0)
  );
}

export function skillModifier(input: {
  score: number;
  training: SkillTraining | undefined;
  proficiencyBonus: number;
}): number {
  const trained = input.training === undefined ? 0 : input.proficiencyBonus;
  const doubled = input.training === "expert" ? input.proficiencyBonus : 0;
  return abilityModifier(input.score) + trained + doubled;
}

const PASSIVE_BASE = 10;

export function passivePerception(perceptionModifier: number): number {
  return PASSIVE_BASE + perceptionModifier;
}

export function initiativeModifier(input: { dexterity: number; wisdom: number }): number {
  return Math.floor((abilityModifier(input.dexterity) + abilityModifier(input.wisdom)) / 2);
}

export function preparedLimit(intelligence: number, wizardLevel: number): number {
  assertCharacterLevel(wizardLevel);
  return abilityModifier(intelligence) + wizardLevel;
}
