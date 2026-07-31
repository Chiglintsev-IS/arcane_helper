/**
 * Руны создателя рун (F-13).
 *
 * Руна прикладывается к заклинанию, сотворённому с расходом ячейки, и не требует отдельного
 * действия ([FR-151](../../docs/features/F-13-runes.md#fr-151)). Её эффект зависит от уровня ячейки,
 * поэтому число считается и показывается до подтверждения — как и повышение уровня заклинания
 * ([FR-152](../../docs/features/F-13-runes.md#fr-152)).
 *
 * Числа взяты из документа подкласса игрока и ждут сверки с мастером: механика «Создателя рун» —
 * материал Unearthed Arcana, существующий в нескольких редакциях
 * ([OQ-14](../../docs/open-questions.md#oq-14)).
 */

import { MAXIMUM_SPELL_LEVEL, MINIMUM_SPELL_LEVEL } from "./slots";
import { RulesError } from "./abilities";

export const RUNES = ["life", "war", "wind"] as const;

export type Rune = (typeof RUNES)[number];

export const RUNE_LABEL: Record<Rune, string> = {
  life: "Руна жизни",
  war: "Руна войны",
  wind: "Руна ветра",
};

function assertSlotLevel(slotLevel: number): void {
  if (
    !Number.isInteger(slotLevel) ||
    slotLevel < MINIMUM_SPELL_LEVEL ||
    slotLevel > MAXIMUM_SPELL_LEVEL
  ) {
    throw new RulesError(`Уровень ячейки для руны вне допустимого диапазона: ${slotLevel}`);
  }
}

/**
 * Временные хиты «Руны жизни» числом ([FR-152](../../docs/features/F-13-runes.md#fr-152)).
 *
 * Отдельно от текста объявления, потому что это же число начисляется состоянию: заклинатель входит
 * в число союзников в пределах 30 футов ([OQ-14](../../docs/open-questions.md#oq-14), подтверждено
 * игроком). Считаются они здесь одной формулой — иначе мастеру можно было бы назвать одно, а
 * персонажу начислить другое.
 */
export function lifeRuneTemporaryHitPoints(slotLevel: number): number {
  assertSlotLevel(slotLevel);
  return 5 * slotLevel;
}

/**
 * Числовой результат руны на выбранном уровне ячейки — готовым числом, а не формулой.
 *
 * «Половина уровня ячейки с округлением вверх, минимум +1» — это то, что игрок иначе считает в уме
 * ровно тогда, когда объявляет действие мастеру.
 */
export function runeEffect(rune: Rune, slotLevel: number): string {
  assertSlotLevel(slotLevel);
  switch (rune) {
    case "life":
      return `${lifeRuneTemporaryHitPoints(slotLevel)} временных хитов союзникам в пределах 30 футов`;
    case "war":
      return `+${Math.max(1, Math.ceil(slotLevel / 2))} к броскам атаки союзников в пределах 30 футов до конца вашего следующего хода`;
    default:
      return `+${5 * slotLevel} футов скорости и защита от атак вдогонку до начала вашего следующего хода`;
  }
}
