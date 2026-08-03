import { DomainError } from "@/core/domain/shared/errors";
import { MINIMUM_SPELL_LEVEL } from "@/core/domain/arcana/slots";
import { MAXIMUM_SPELL_LEVEL } from "@/core/domain/catalog/spell";

export const RUNES = ["life", "war", "wind"] as const;

export type Rune = (typeof RUNES)[number];

/** Кому досталась «Руна жизни». Прочие руны выбора не требуют: ветер — на себя, война — на чужого. */
export const RUNE_TARGETS = ["self", "other"] as const;

export type RuneTarget = (typeof RUNE_TARGETS)[number];

export const RUNE_LABEL: Record<Rune, string> = {
  life: "Руна жизни",
  war: "Руна войны",
  wind: "Руна ветра",
};

export const RUNE_TARGET_LABEL: Record<RuneTarget, string> = {
  self: "Себе",
  other: "Другому",
};

function assertSlotLevel(slotLevel: number): void {
  if (
    !Number.isInteger(slotLevel) ||
    slotLevel < MINIMUM_SPELL_LEVEL ||
    slotLevel > MAXIMUM_SPELL_LEVEL
  ) {
    throw new DomainError(`Уровень ячейки для руны вне допустимого диапазона: ${slotLevel}`);
  }
}

/** Одна формула на объявление и на состояние: иначе мастеру назовут одно, а персонажу начислят другое. */
export function lifeRuneTemporaryHitPoints(slotLevel: number): number {
  assertSlotLevel(slotLevel);
  return 5 * slotLevel;
}

export function warRuneAttackBonus(slotLevel: number): number {
  assertSlotLevel(slotLevel);
  return Math.max(1, Math.ceil(slotLevel / 2));
}

export function windRuneExtraSpeedFeet(slotLevel: number): number {
  assertSlotLevel(slotLevel);
  return 5 * slotLevel;
}

/** Выбирает ли руна цель. Только жизнь: война всегда на чужого, ветер всегда на себя. */
export function runeChoosesTarget(rune: Rune): boolean {
  return rune === "life";
}

/** Результат руны готовым числом: половину уровня ячейки игрок иначе считает в уме перед мастером. */
export function runeEffect(rune: Rune, slotLevel: number): string {
  switch (rune) {
    case "life":
      return `${lifeRuneTemporaryHitPoints(slotLevel)} временных хитов одному существу в пределах 30 футов — можно себе`;
    case "war":
      return `+${warRuneAttackBonus(slotLevel)} к броскам атаки по одному существу в пределах 30 футов до конца вашего следующего хода`;
    default:
      return `+${windRuneExtraSpeedFeet(slotLevel)} футов скорости себе и никаких атак по возможности до начала вашего следующего хода`;
  }
}

/**
 * Причина, по которой руну сейчас не приложить; `null` — приложить можно.
 *
 * Руна прикладывается только к заклинанию, оплаченному ячейкой: очки заклинаний покупают само
 * сотворение, а руна — особенность подкласса поверх потраченной ячейки.
 */
export function runeUnavailability(paidWithSlot: boolean, runesRemaining: number): string | null {
  if (!paidWithSlot) return "При оплате кровью руна не применяется";
  if (runesRemaining <= 0) return "Рун не осталось, вернутся долгим отдыхом";
  return null;
}
