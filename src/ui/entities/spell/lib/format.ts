/**
 * Русские подписи, нужные только строке списка и подробной карточке: роль в бою, время
 * накладывания, цена, длительность, урон, ритуал.
 *
 * Здесь нет ни одной игровой формулы: числа приходят из данных и движка правил, а этот модуль только
 * выбирает слово и падеж. Аббревиатуры русские — «КС», «КД», а не DC и AC.
 */

import type { SpellCardView, SpellRowView } from "@/contract/views";
import {
  longCastingTimeRu,
  plural,
  timeSpanAccusativeRu,
  type LongCastingUnit,
  type TimeUnit,
} from "@/shared/language";
import { TONE_GLYPH, type Tone } from "@/ui/shared/ui/tone";

/** Заговор ячейки не стоит. Число — цена строки, а не вид заклинания. */
const CANTRIP_LEVEL = 0;

/**
 * Подпись и цвет роли в бою.
 *
 * Знак роли приходит от владельца тонов и стоит рядом с подписью всюду, где роль называют:
 * цвет — последний из трёх носителей, и без первых двух он не носитель вовсе (ux.md).
 *
 * «Боевое», а не «Атака»: слово «Атака» на той же строке уже занято способом разрешения — броском
 * d20 против КД. Два смысла под одним словом в соседних значках сделали бы и значок, и фильтр
 * непредсказуемыми (глоссарий).
 *
 * У роли «другое» цвета нет: приглушённый тон и означает «ни то, ни другое», а третий оттенок
 * превратил бы шкалу в радугу, в которой не выделяется ничего (ux.md).
 */
type RoleBadge = { label: string; tone: Tone };

const OTHER_ROLE: RoleBadge = { label: "Другое", tone: "muted" };

const COMBAT_ROLE: Record<string, RoleBadge> = {
  offense: { label: "Боевое", tone: "offense" },
  defense: { label: "Защита", tone: "defense" },
  other: OTHER_ROLE,
};

/** Подпись роли по слову правил: незнакомая роль остаётся без цвета, как и «ни то, ни другое». */
export function combatRole(role: string): RoleBadge {
  return COMBAT_ROLE[role] ?? OTHER_ROLE;
}

type CastingTimeBadge = { label: string; icon: string; tone: Tone };

/**
 * Подпись, знак и цвет времени накладывания. Знак обязателен: цвет один не решает.
 *
 * Знак приходит от владельца тонов там, где он и означает свой тон. Минуты и часы берут свой:
 * приглушённый тон здесь говорит «вне экономии хода», а знак его владельца сказал бы «нельзя».
 */
const CASTING_TIME: Record<string, CastingTimeBadge> = {
  action: { label: "Действие", icon: TONE_GLYPH.action, tone: "action" },
  bonus_action: { label: "Бонусное", icon: TONE_GLYPH.bonus, tone: "bonus" },
  reaction: { label: "Реакция", icon: TONE_GLYPH.reaction, tone: "reaction" },
  minute: { label: "Минуты", icon: "◷", tone: "muted" },
  hour: { label: "Часы", icon: "◷", tone: "muted" },
};

/** Значок времени накладывания: незнакомое время показывается серым, а не пропадает со строки. */
export function castingTimeBadge(type: string): CastingTimeBadge {
  return CASTING_TIME[type] ?? { label: type, icon: "◷", tone: "muted" };
}

const LONG_CASTING_UNITS: Record<string, LongCastingUnit | undefined> = {
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
export function castingTimeLabel(castingTime: SpellRowView["castingTime"]): string {
  const unit = LONG_CASTING_UNITS[castingTime.type];
  if (unit === undefined || castingTime.value === undefined) {
    return castingTimeBadge(castingTime.type).label;
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
export function castingTimePhrase(castingTime: SpellRowView["castingTime"]): string {
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
export function slotCostLabel(spell: SpellRowView): string {
  if (spell.level === CANTRIP_LEVEL) return "Без ячейки";
  // «От» — обещание, что ячейка повыше что-то даст; даёт ли, сказала проекция.
  const slot = spell.benefitsFromHigherSlot
    ? `Ячейка от ${spell.level} ур.`
    : `Ячейка ${spell.level} ур.`;
  return spell.ritual ? `${slot} или ритуал` : slot;
}

export function durationLabel(duration: SpellRowView["duration"]): string {
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

export function targetingLabel(targeting: SpellCardView["targeting"]): string {
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
const DURATION_UNITS: Record<string, TimeUnit | undefined> = {
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
export function durationPhrase(duration: SpellRowView["duration"]): string {
  if (duration.type === "instant") return "Мгновенный эффект";
  const unit = DURATION_UNITS[duration.type];
  if (unit === undefined || duration.value === undefined) return "Длительность особая";
  return `Держится ${timeSpanAccusativeRu(unit, duration.value)}`;
}

/** Урон словами: формула с учётом уровня и род урона. Считает их проекция. */
export function damageLabel(damage: SpellRowView["damage"]): string | null {
  if (damage === undefined) return null;
  return `${damage.formula} (${damage.type})`;
}

/**
 * Значок «Ритуал» — или `null`, когда добавлять нечего.
 *
 * Единственный случай, о котором сказать больше некому: неподготовленный ритуал творится прямо из
 * книги, и без подписи цена «Ячейка 1 ур. или ритуал» обещала бы способ, которого сейчас нет.
 * Подготовку значками не пересказывают: рядом стоит кнопка с галочкой, а запрет пишется словами.
 */
export function ritualOnlyBadge(
  spell: SpellRowView,
): { label: string; icon: string; tone: Tone } | null {
  if (spell.ritual && !spell.prepared) {
    return { label: "Ритуал", icon: TONE_GLYPH.ritual, tone: "ritual" };
  }
  return null;
}
