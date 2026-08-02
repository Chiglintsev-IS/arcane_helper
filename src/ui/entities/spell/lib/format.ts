/**
 * Русские подписи полей заклинания.
 *
 * Здесь нет ни одной игровой формулы: числа приходят из данных и движка правил, а этот модуль только
 * выбирает слово и падеж. Аббревиатуры русские — «КС», «КД», а не DC и AC.
 */

import type { CharacterState } from "@/core/domain/character/state";
import type { Spell } from "@/core/domain/catalog/spell";
import type { CombatRole } from "@/core/domain/catalog/combatRole";
import {
  longCastingTimeRu,
  plural,
  timeSpanAccusativeRu,
  type LongCastingUnit,
  type TimeUnit,
} from "@/core/shared/language";
import { effectiveDamage } from "@/core/domain/catalog/scaling";
import { CANTRIP_LEVEL } from "@/core/domain/arcana/slots";
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

const ABILITY_NAMES: Record<string, string> = {
  STR: "Силы",
  DEX: "Ловкости",
  CON: "Телосложения",
  INT: "Интеллекта",
  WIS: "Мудрости",
  CHA: "Харизмы",
};

export function levelLabel(level: number): string {
  return level === CANTRIP_LEVEL ? "Заговор" : `${level} уровень`;
}

/**
 * Уровень для полосы фильтров: «1 ур.» вместо «1 уровень».
 *
 * С девятью переключателями и пятью уровнями книги полное слово стоило полосе третьего ряда — то
 * есть карточки заклинания на экране iPhone SE.
 * Сокращение «ур.» уже используется на плитках ячеек и в значке цены, так что нового слова тут нет.
 */
export function levelChipLabel(level: number): string {
  return level === CANTRIP_LEVEL ? "Заговор" : `${level} ур.`;
}

/**
 * Минимальная стоимость применения: ячейка какого уровня нужна, чтобы сотворить заклинание.
 *
 * Показывается рядом с названием, потому что уровень заклинания и цена применения — разные вопросы:
 * «1 уровень» ничего не говорит о том, хватит ли ресурсов, а «ячейка от 1 ур.» говорит.
 *
 * У заговора стоимости нет: `null`, а не «Без ячейки». Рядом уже стоит значок «Заговор», и два
 * значка говорили одно и то же — заговор ячейку не тратит по определению.
 */
export function slotCostLabel(spell: Spell): string | null {
  if (spell.level === CANTRIP_LEVEL) return null;
  // «От» — обещание, что ячейка повыше что-то даст. Если повышать нечего, обещать нельзя: игрок
  // потратит ячейку 3 уровня на заклинание, которое сработает ровно как с ячейки первой.
  const scales = spell.damage?.scaling !== undefined || spell.higherLevelsRu !== undefined;
  const slot = scales ? `Ячейка от ${spell.level} ур.` : `Ячейка ${spell.level} ур.`;
  return spell.ritual ? `${slot} или ритуал` : slot;
}

export function rangeLabel(range: Spell["range"]): string {
  switch (range.type) {
    case "self":
      return "На себя";
    case "touch":
      return "Касание";
    case "distance":
      return `${range.distanceFeet} ${plural(range.distanceFeet ?? 0, ["фут", "фута", "футов"])}`;
    default:
      return "Особая";
  }
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

const AREA_SHAPES: Record<string, string> = {
  cone: "Конус",
  cube: "Куб",
  line: "Линия",
  sphere: "Сфера",
  cylinder: "Цилиндр",
};

export function areaLabel(area: NonNullable<Spell["area"]>): string {
  return `${AREA_SHAPES[area.shape] ?? area.shape}, ${area.sizeFeet} ${plural(area.sizeFeet, ["фут", "фута", "футов"])}`;
}

/** Кто бросает и против чего — самая частая путаница за столом (rules-engine.md). */
export function resolutionLabel(resolution: Spell["resolution"], spellSaveDc: number): string {
  switch (resolution.type) {
    case "spell_attack":
      return "Атака заклинанием: бросаете вы";
    case "saving_throw":
      return `Спасбросок ${ABILITY_NAMES[resolution.savingThrow ?? ""] ?? ""} против КС ${spellSaveDc}: бросает цель`;
    default:
      return "Броска нет";
  }
}

// Падеж один и тот же, что в подробной карточке: «Спасбросок Ловкости». Второго словаря
// сокращений здесь не заводится — расхождение между строкой и карточкой читалось бы как разные
// заклинания.

/** Знак перед модификатором пишется всегда: «d20+8» произносят вслух именно так. */
export function signed(modifier: number): string {
  return modifier < 0 ? `−${Math.abs(modifier)}` : `+${modifier}`;
}

/** Числа персонажа, из которых собирается значок разрешения. Хранимые, а не выведенные. */
export type ResolutionNumbers = Pick<CharacterState, "spellSaveDc" | "spellAttackModifier">;

/**
 * Как заклинание разрешается — числом, а не видом броска.
 *
 * «Атака» и «Спасбросок Ловкости» отвечают на половину вопроса: следом игрок спрашивает, какое
 * число называть мастеру. Значок отвечает сразу и тем, что произносят вслух, — «d20+8», «КС 16».
 * Числа берутся из состояния персонажа: у Торна оба включают +1 от предмета, и книга их не знает
 * (rules-engine.md).
 */
export function resolutionBadge(
  resolution: Spell["resolution"],
  numbers: ResolutionNumbers,
): { label: string; icon: string; tone: Tone } {
  switch (resolution.type) {
    case "spell_attack":
      return { label: `d20${signed(numbers.spellAttackModifier)}`, icon: "✶", tone: "action" };
    case "saving_throw":
      return {
        label: `Спасбросок ${ABILITY_NAMES[resolution.savingThrow ?? ""] ?? ""} КС ${numbers.spellSaveDc}`,
        icon: "◇",
        tone: "bonus",
      };
    default:
      return { label: "Без броска", icon: "○", tone: "muted" };
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
 * Что о подготовке добавляет значок — или `null`, если добавлять нечего
 *
 * «Подготовлено» и «Не подготовлено» отсюда убраны: в «Книге» рядом со строкой стоит кнопка
 * подготовки — нажатая, с галочкой и с `aria-pressed`, — а когда из-за подготовки нельзя сотворить,
 * строка пишет причину словами. Значок был третьим ответом на тот же вопрос и стоил ряда.
 *
 * Остаются два случая, о которых сказать больше некому:
 * заговор — он вне лимита подготовки,
 * кнопки не получает вовсе, и значок говорит о цене: ячейку заговор не тратит;
 * неподготовленный ритуал — он творится прямо из книги
 *, и без подписи цена «Ячейка 1
 * ур. или ритуал» обещала бы способ, которого сейчас нет.
 */
export function preparationBadge(
  spell: Spell,
  preparedSpellIds: readonly string[],
): { label: string; icon: string; tone: Tone } | null {
  if (spell.level === CANTRIP_LEVEL) return { label: "Заговор", icon: "◎", tone: "muted" };
  if (spell.ritual && !preparedSpellIds.includes(spell.id)) {
    return { label: "Только ритуалом", icon: "❖", tone: "muted" };
  }
  return null;
}
