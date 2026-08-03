/**
 * Русские подписи, нужные только строке списка и подробной карточке: роль в бою, время
 * накладывания, цена, длительность, урон, ритуал.
 *
 * Здесь нет ни одной игровой формулы: числа приходят из данных и движка правил, а этот модуль только
 * выбирает слово и падеж. Аббревиатуры русские — «КС», «КД», а не DC и AC.
 */

import type { Spell } from "@/core/domain/catalog/spell";
import type { CombatRole } from "@/core/domain/catalog/combatRole";
import {
  longCastingTimeRu,
  plural,
  timeSpanAccusativeRu,
  type LongCastingUnit,
  type TimeUnit,
} from "@/core/shared/language";
import { benefitsFromHigherSlot, effectiveDamage } from "@/core/domain/catalog/scaling";
import { isSpellReady } from "@/core/application/casting/castOptions";
import type { CharacterState } from "@/core/domain/assembly/state";
import { CANTRIP_LEVEL } from "@/core/domain/catalog/spell";
import { type Tone } from "@/ui/shared/ui/tone";

/**
 * Подпись, иконка и цвет роли в бою.
 *
 * «Боевое», а не «Атака»: слово «Атака» на той же строке уже занято способом разрешения — броском
 * d20 против КД. Два смысла под одним словом в соседних значках сделали бы и значок, и фильтр
 * непредсказуемыми (глоссарий).
 *
 * У роли «другое» цвета нет: серый и означает «ни то, ни другое», а третий оттенок превратил бы
 * шкалу в радугу, в которой не выделяется ничего (ux.md).
 */
export const COMBAT_ROLE: Record<CombatRole, { label: string; icon?: string; tone: Tone }> = {
  offense: { label: "Боевое", icon: "⚔", tone: "offense" },
  defense: { label: "Защита", icon: "⛊", tone: "defense" },
  other: { label: "Другое", tone: "muted" },
};

export type CastingTimeType = Spell["castingTime"]["type"];

/** Подпись, иконка и цвет времени накладывания. Иконка обязательна: цвет один не решает. */
export const CASTING_TIME: Record<CastingTimeType, { label: string; icon: string; tone: Tone }> = {
  action: { label: "Действие", icon: "●", tone: "action" },
  bonus_action: { label: "Бонусное", icon: "◆", tone: "bonus" },
  reaction: { label: "Реакция", icon: "▲", tone: "reaction" },
  // Серые: минуты и часы вне экономии действий, цвет действия обещал бы ход, которого не хватит.
  minute: { label: "Минуты", icon: "◷", tone: "muted" },
  hour: { label: "Часы", icon: "◷", tone: "muted" },
};

const LONG_CASTING_UNITS: Partial<Record<CastingTimeType, LongCastingUnit>> = {
  minute: "minute",
  hour: "hour",
};

/**
 * Время накладывания для бейджа: «Действие» или точное «1 минута».
 *
 * Категория «Минуты» остаётся только для данных без числа: схема такого не пропускает
 * (domain-model.md), но приблизительная подпись честнее
 * выдуманного числа.
 */
export function castingTimeLabel(castingTime: Spell["castingTime"]): string {
  const unit = LONG_CASTING_UNITS[castingTime.type];
  if (unit === undefined || castingTime.value === undefined) {
    return CASTING_TIME[castingTime.type].label;
  }
  return longCastingTimeRu(unit, castingTime.value);
}

/**
 * Время накладывания там, где подписи рядом нет: в значке строки списка и в мастере.
 *
 * «Действие», «Бонусное» и «Реакция» остаются одним словом — они называют ресурс хода, и спутать их
 * с длительностью нельзя. Минуты и часы — единственный случай, где значок и текст на одной строке
 * оба означали время и ни один не говорил какое: «Починка» показывала «1 минута» рядом с
 * «Мгновенно». Глагол отвечает на вопрос сразу.
 */
export function castingTimePhrase(castingTime: Spell["castingTime"]): string {
  const unit = LONG_CASTING_UNITS[castingTime.type];
  if (unit === undefined || castingTime.value === undefined) {
    return castingTimeLabel(castingTime);
  }
  return `Накладывать ${timeSpanAccusativeRu(unit, castingTime.value)}`;
}

export function levelLabel(level: number): string {
  return level === CANTRIP_LEVEL ? "Заговор" : `${level} уровень`;
}

/**
 * Уровень для полосы фильтров: «1 ур.» вместо «1 уровень».
 *
 * Нулевой уровень назван ценой, а не видом: «Без ячейки» ловит и заговоры, и то, что заклинанием не
 * является вовсе, — «Магию крови» и классовые особенности. Отбирают здесь по цене.
 */
export function levelChipLabel(level: number): string {
  return level === CANTRIP_LEVEL ? "Без ячейки" : `${level} ур.`;
}

/**
 * Минимальная стоимость применения: ячейка какого уровня нужна, чтобы сотворить заклинание.
 *
 * Показывается рядом с названием, потому что уровень заклинания и цена применения — разные вопросы:
 * «1 уровень» ничего не говорит о том, хватит ли ресурсов, а «ячейка от 1 ур.» говорит.
 *
 * Заговор отвечает «Без ячейки» тем же способом: это цена, а не вид заклинания, и второго значка
 * рядом для неё не заводится.
 */
export function slotCostLabel(spell: Spell): string {
  if (spell.level === CANTRIP_LEVEL) return "Без ячейки";
  // «От» — обещание, что ячейка повыше что-то даст; даст ли, знает каталог.
  const slot = benefitsFromHigherSlot(spell)
    ? `Ячейка от ${spell.level} ур.`
    : `Ячейка ${spell.level} ур.`;
  return spell.ritual ? `${slot} или ритуал` : slot;
}

export function durationLabel(duration: Spell["duration"]): string {
  const value = duration.value ?? 0;
  switch (duration.type) {
    case "instant":
      return "Мгновенная";
    case "rounds":
      return `${value} ${plural(value, ["раунд", "раунда", "раундов"])}`;
    case "minutes":
      return `${value} ${plural(value, ["минута", "минуты", "минут"])}`;
    case "hours":
      return `${value} ${plural(value, ["час", "часа", "часов"])}`;
    default:
      return "Особая";
  }
}

export function targetingLabel(targeting: Spell["targeting"]): string {
  switch (targeting.type) {
    case "self":
      return "На себя";
    case "creature":
      return "Одно существо";
    case "creatures":
      return targeting.maximumTargets === undefined
        ? "Несколько существ"
        : `До ${targeting.maximumTargets} существ`;
    case "object":
      return "Предмет";
    case "point":
      return "Точка в пространстве";
    default:
      return "Область";
  }
}

/** Единицы длительности в терминах морфологии. `instant` и `special` числа не несут. */
const DURATION_UNITS: Partial<Record<Spell["duration"]["type"], TimeUnit>> = {
  rounds: "round",
  minutes: "minute",
  hours: "hour",
};

/**
 * Длительность там, где подписи рядом нет: строка фактов краткой карточки.
 *
 * Парная к `castingTimePhrase`: одна говорит, сколько заклинание накладывают, вторая — сколько оно
 * держится. До обе печатались голым числом, и «Паутина» показывала «Действие» рядом с «1 час»
 * — второе читалось как время накладывания.
 *
 * «Мгновенный эффект», а не «Мгновенно»: наречие отвечает на вопрос «как быстро творится», то есть
 * ровно на тот вопрос, от которого длительность и нужно отличить.
 */
export function durationPhrase(duration: Spell["duration"]): string {
  if (duration.type === "instant") return "Мгновенный эффект";
  const unit = DURATION_UNITS[duration.type];
  if (unit === undefined || duration.value === undefined) return "Длительность особая";
  return `Держится ${timeSpanAccusativeRu(unit, duration.value)}`;
}

/** Формула урона с учётом уровня ячейки и уровня персонажа: заговоры растут от уровня. */
export function damageLabel(spell: Spell, slotLevel: number, characterLevel: number): string | null {
  if (spell.damage === undefined) return null;
  const formula = effectiveDamage(spell.damage, {
    spellLevel: spell.level,
    slotLevel,
    characterLevel,
  });
  return `${formula} (${spell.damage.type})`;
}

/**
 * Значок «Ритуал» — или `null`, когда добавлять нечего.
 *
 * Единственный случай, о котором сказать больше некому: неподготовленный ритуал творится прямо из
 * книги, и без подписи цена «Ячейка 1 ур. или ритуал» обещала бы способ, которого сейчас нет.
 * Подготовку значками не пересказывают: рядом стоит кнопка с галочкой, а запрет пишется словами.
 */
export function ritualOnlyBadge(
  spell: Spell,
  character: CharacterState,
): { label: string; icon: string; tone: Tone } | null {
  if (spell.ritual && !isSpellReady(spell, character)) {
    return { label: "Ритуал", icon: "❖", tone: "muted" };
  }
  return null;
}
