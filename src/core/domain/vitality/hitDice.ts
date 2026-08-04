import { DomainError } from "@/core/domain/shared/errors";

/**
 * Во что заклинанию обходятся Кости хитов. Форма описана здесь, а не взята у каталога: карточку
 * жизнеспособность не знает, а поля совпадают — вызывающий передаёт цену прямо из карточки.
 */
type HitDiceCost = {
  maximumDice: number;
  extraDicePerSlotLevel: number;
  addsSpellcastingModifier: boolean;
};

/**
 * Среднее за кость хитов при взятии уровня: половина грани плюс один.
 *
 * Правило «среднее вместо броска» из книги: у d6 это 4. Кость всё равно бросает игрок — приложение
 * называет число, но не подставляет его.
 */
export function averagePerHitDie(size: number): number {
  if (!Number.isInteger(size) || size <= 0) {
    throw new DomainError(`У кости должна быть грань, получено ${size}`);
  }
  return Math.floor(size / 2) + 1;
}

export function hitDiceRegainedOnLongRest(total: number): number {
  if (!Number.isInteger(total) || total <= 0) {
    throw new DomainError(`Костей хитов должно быть хотя бы одна, получено ${total}`);
  }
  const half = Math.floor(total / 2);
  return Math.max(1, half);
}

function slotLevelsAboveSpell(slotLevel: number, spellLevel: number): number {
  return Math.max(0, slotLevel - spellLevel);
}

export function maximumHitDiceForCast(
  cost: HitDiceCost,
  spellLevel: number,
  slotLevel: number,
  remaining: number,
): number {
  const allowedByCost =
    cost.maximumDice + cost.extraDicePerSlotLevel * slotLevelsAboveSpell(slotLevel, spellLevel);
  return Math.min(allowedByCost, remaining);
}

/**
 * Что вообще может выпасть на стольких костях: от числа костей до числа костей на грань.
 *
 * Приложение кубики не бросает и принимает результат от игрока — значит обязано знать, какой
 * результат возможен: опечатка в вводе иначе уходит в состояние и в журнал.
 */
export function hitDiceRollRange(count: number, size: number): { minimum: number; maximum: number } {
  if (!Number.isInteger(count) || count <= 0) {
    throw new DomainError(`Костей должно быть хотя бы одна, получено ${count}`);
  }
  if (!Number.isInteger(size) || size <= 0) {
    throw new DomainError(`У кости должна быть грань, получено ${size}`);
  }
  return { minimum: count, maximum: count * size };
}

/** Возможно ли такое выпавшее на стольких костях. */
export function isPossibleHitDiceRoll(rolled: number, count: number, size: number): boolean {
  const { minimum, maximum } = hitDiceRollRange(count, size);
  return rolled >= minimum && rolled <= maximum;
}

/** Выпавшее на костях приходит от игрока: приложение кубики не бросает. */
export function hitDiceHealing(
  cost: HitDiceCost,
  rolled: number,
  spellcastingModifier: number,
): number {
  return rolled + (cost.addsSpellcastingModifier ? spellcastingModifier : 0);
}
