/**
 * Русские подписи полей заклинания.
 *
 * Здесь нет ни одной игровой формулы: числа приходят из данных и движка правил, а этот модуль только
 * выбирает слово и падеж. Аббревиатуры русские — «КС», «КД», а не DC и AC (ux.md#текст-в-интерфейсе).
 */

import type { Spell } from "@/data/schemas/spell";
import { longCastingTimeRu, plural, type LongCastingUnit } from "@/rules/language";
import { effectiveDamage } from "@/rules/scaling";
import { CANTRIP_LEVEL } from "@/rules/slots";

/** Смысловые роли цвета из ux.md#цветовая-система. Цвет всегда с иконкой и подписью. */
export type Tone = "action" | "bonus" | "reaction" | "concentration" | "ritual" | "muted";

export const TONE_CLASS: Record<Tone, string> = {
  action: "border-action/50 bg-action/10 text-action-strong dark:text-action",
  bonus: "border-bonus/50 bg-bonus/10 text-bonus-strong dark:text-bonus",
  reaction: "border-reaction/50 bg-reaction/10 text-reaction-strong dark:text-reaction",
  concentration:
    "border-concentration/50 bg-concentration/10 text-concentration-strong dark:text-concentration",
  ritual: "border-ritual/50 bg-ritual/10 text-ritual-strong dark:text-ritual",
  muted: "border-slate-400/50 bg-slate-400/10 text-slate-700 dark:text-slate-300",
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
 * Время накладывания для бейджа: «Действие» или точное «1 минута» ([FR-033](../../../docs/features/F-03-cast-wizard.md#fr-033)).
 *
 * Категория «Минуты» остаётся только для данных без числа: схема такого не пропускает
 * ([domain-model.md](../../../docs/domain-model.md#заклинание)), но приблизительная подпись честнее
 * выдуманного числа.
 */
export function castingTimeLabel(castingTime: Spell["castingTime"]): string {
  const unit = LONG_CASTING_UNITS[castingTime.type];
  if (unit === undefined || castingTime.value === undefined) {
    return CASTING_TIME[castingTime.type].label;
  }
  return longCastingTimeRu(unit, castingTime.value);
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
 * Минимальная стоимость применения: ячейка какого уровня нужна, чтобы сотворить заклинание.
 *
 * Показывается рядом с названием, потому что уровень заклинания и цена применения — разные вопросы:
 * «1 уровень» ничего не говорит о том, хватит ли ресурсов, а «ячейка от 1 ур.» говорит.
 *
 * У заговора стоимости нет: `null`, а не «Без ячейки». Рядом уже стоит значок «Заговор», и два
 * значка говорили одно и то же — заговор ячейку не тратит по определению (FR-010).
 */
export function slotCostLabel(spell: Spell): string | null {
  if (spell.level === CANTRIP_LEVEL) return null;
  return spell.ritual ? `Ячейка от ${spell.level} ур. или ритуал` : `Ячейка от ${spell.level} ур.`;
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

const ABILITY_SHORT: Record<string, string> = {
  STR: "Силы",
  DEX: "Ловкости",
  CON: "Телосложения",
  INT: "Интеллекта",
  WIS: "Мудрости",
  CHA: "Харизмы",
};

/**
 * Как заклинание разрешается — коротко, для строки списка (FR-010).
 *
 * Атакующие отделены от прочих намеренно: за столом первым делом нужно понять, бросать ли атаку,
 * ждать ли спасброска цели или эффект применяется без броска
 * ([rules-engine.md](../../../docs/rules-engine.md#разрешение-заклинания)).
 */
export function resolutionBadge(resolution: Spell["resolution"]): {
  label: string;
  icon: string;
  tone: Tone;
} {
  switch (resolution.type) {
    case "spell_attack":
      return { label: "Атака", icon: "✶", tone: "action" };
    case "saving_throw":
      return {
        label: `Спасбросок ${ABILITY_SHORT[resolution.savingThrow ?? ""] ?? ""}`.trim(),
        icon: "◇",
        tone: "bonus",
      };
    default:
      return { label: "Без броска", icon: "○", tone: "muted" };
  }
}

/** Мгновенное или длящееся — второе требует внимания после применения (F-08). */
export function durationBadge(duration: Spell["duration"]): { label: string; icon: string } {
  return duration.type === "instant"
    ? { label: "Мгновенно", icon: "⚡" }
    : { label: durationLabel(duration), icon: "◷" };
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
 * Подготовлено, лежит в книге или это заговор.
 *
 * Различие обязательно: сотворить можно только подготовленное, а из книги — лишь ритуалом
 * ([FR-100](../../../docs/features/F-09-preparation.md#fr-100), [FR-103](../../../docs/features/F-09-preparation.md#fr-103)).
 */
export function preparationBadge(
  spell: Spell,
  preparedSpellIds: readonly string[],
): { label: string; icon: string; tone: Tone } {
  if (spell.level === CANTRIP_LEVEL) return { label: "Заговор", icon: "◎", tone: "muted" };
  if (preparedSpellIds.includes(spell.id)) {
    return { label: "Подготовлено", icon: "✓", tone: "ritual" };
  }
  return spell.ritual
    ? { label: "Из книги, только ритуалом", icon: "❖", tone: "muted" }
    : { label: "Не подготовлено", icon: "✗", tone: "muted" };
}
