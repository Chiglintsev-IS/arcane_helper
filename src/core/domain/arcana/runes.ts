import { DomainError } from "@/core/domain/shared/errors";
import type { StatContribution } from "@/core/domain/shared/stats";
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

/** Максимум пула рун равен бонусу мастерства. */
export function runesMaximum(proficiencyBonus: number): number {
  return proficiencyBonus;
}

function assertCastLevel(castLevel: number): void {
  if (
    !Number.isInteger(castLevel) ||
    castLevel < MINIMUM_SPELL_LEVEL ||
    castLevel > MAXIMUM_SPELL_LEVEL
  ) {
    throw new DomainError(`Уровень сотворения для руны вне допустимого диапазона: ${castLevel}`);
  }
}

/** Одна формула на объявление и на состояние: иначе мастеру назовут одно, а персонажу начислят другое. */
export function lifeRuneTemporaryHitPoints(castLevel: number): number {
  assertCastLevel(castLevel);
  return 5 * castLevel;
}

function warRuneAttackBonus(castLevel: number): number {
  assertCastLevel(castLevel);
  return Math.max(1, Math.ceil(castLevel / 2));
}

function windRuneExtraSpeedFeet(castLevel: number): number {
  assertCastLevel(castLevel);
  return 5 * castLevel;
}

/** Выбирает ли руна цель. Только жизнь: война всегда на чужого, ветер всегда на себя. */
export function runeChoosesTarget(rune: Rune): boolean {
  return rune === "life";
}

/**
 * Срок руны: сколько раундов держится и каким мгновением кончится. Отсутствует — руна не держится.
 *
 * Раундов у войны два: срок кончается концом вашего следующего хода, а значит его начало
 * переживает; у ветра один — он кончается ровно этим началом. Слово стоит в середине фразы: его
 * дописывают с обеих сторон.
 */
const RUNE_LASTING: Record<Rune, { readonly rounds: number; readonly untilRu: string } | undefined> = {
  life: undefined,
  war: { rounds: 2, untilRu: "до конца вашего следующего хода" },
  wind: { rounds: 1, untilRu: "до начала вашего следующего хода" },
};

/** Что руна даёт числом, без срока: срок называется отдельно и есть не у каждой руны. */
function runeGainRu(rune: Rune, castLevel: number): string {
  switch (rune) {
    case "life":
      return `${lifeRuneTemporaryHitPoints(castLevel)} временных хитов одному существу в пределах 30 футов — можно себе`;
    case "war":
      return `+${warRuneAttackBonus(castLevel)} к броскам атаки по одному существу в пределах 30 футов`;
    default:
      return `+${windRuneExtraSpeedFeet(castLevel)} футов скорости себе и никаких атак по возможности`;
  }
}

/** Результат руны готовым числом: половину уровня сотворения игрок иначе считает в уме перед мастером. */
export function runeEffect(rune: Rune, castLevel: number): string {
  const lasting = RUNE_LASTING[rune];
  const gain = runeGainRu(rune, castLevel);
  return lasting === undefined ? gain : `${gain} ${lasting.untilRu}`;
}

/**
 * Что пробуждённая руна оставляет после сотворения: срок раундами, чем он кончится словами, число
 * этого сотворения и вклад в величины листа. `null` — руна следа не оставляет.
 *
 * Следа нет у жизни: оставленное ею — начисленные временные хиты, и они живут по своему правилу.
 * Война кладётся на чужое существо, поэтому листу не приносит ничего; ветер поднимает скорость
 * самому заклинателю, и это его собственная величина.
 */
type RuneTrace = {
  readonly rounds: number;
  readonly endConditionRu: string;
  readonly noteRu: string;
  readonly contributions: readonly StatContribution[];
};

export function runeTrace(rune: Rune, castLevel: number): RuneTrace | null {
  const lasting = RUNE_LASTING[rune];
  if (lasting === undefined) return null;
  return {
    rounds: lasting.rounds,
    endConditionRu: `Держится ${lasting.untilRu}.`,
    noteRu: runeGainRu(rune, castLevel),
    contributions:
      rune === "wind"
        ? [{ stat: "speed", kind: "bonus", value: windRuneExtraSpeedFeet(castLevel) }]
        : [],
  };
}

/**
 * Причина, по которой руну сейчас не приложить; `null` — приложить можно.
 *
 * Руна ложится на уровень сотворения, а не на ресурс, которым он оплачен: ячейка и кровь для неё
 * одно и то же. Заговор и ритуал уровня сотворения не имеют — считать эффект руны там не от чего.
 */
export function runeUnavailability(castLevel: number | undefined, runesRemaining: number): string | null {
  if (castLevel === undefined) return "У заговора и ритуала нет уровня сотворения — руну не приложить";
  if (runesRemaining <= 0) return "Рун не осталось, вернутся долгим отдыхом";
  return null;
}
