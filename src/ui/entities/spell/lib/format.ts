import type { CastingView, SpellCardView, SpellRowView } from "@/contract/views";
import {
  CHECK_DIE_RU,
  CURRENCY_ABBREVIATIONS,
  ROUNDS_PER_MINUTE,
  SAVING_THROW_SHORT,
  longCastingTimeRu,
  plural,
  timeSpanAccusativeRu,
  type LongCastingUnit,
  type TimeUnit,
} from "@/shared/language";
import { TONE_GLYPH, type Tone } from "@/ui/shared/ui/tone";
import { signed } from "@/shared/language";

const CANTRIP_LEVEL = 0;

type RoleBadge = { label: string; tone: Tone };

const OTHER_ROLE: RoleBadge = { label: "Другое", tone: "muted" };

const COMBAT_ROLE: Record<string, RoleBadge> = {
  offense: { label: "Боевое", tone: "offense" },
  defense: { label: "Защита", tone: "defense" },
  other: OTHER_ROLE,
};

export function combatRole(role: string): RoleBadge {
  return COMBAT_ROLE[role] ?? OTHER_ROLE;
}

type CastingTimeBadge = { label: string; icon: string; tone: Tone };

const CASTING_TIME: Record<string, CastingTimeBadge> = {
  action: { label: "Действие", icon: TONE_GLYPH.action, tone: "action" },
  bonus_action: { label: "Бонусное", icon: TONE_GLYPH.bonus, tone: "bonus" },
  reaction: { label: "Реакция", icon: TONE_GLYPH.reaction, tone: "reaction" },
  minute: { label: "Минуты", icon: "◷", tone: "muted" },
  hour: { label: "Часы", icon: "◷", tone: "muted" },
};

export function castingTimeBadge(type: string): CastingTimeBadge {
  return CASTING_TIME[type] ?? { label: type, icon: "◷", tone: "muted" };
}

const LONG_CASTING_UNITS: Record<string, LongCastingUnit | undefined> = {
  minute: "minute",
  hour: "hour",
};

export function castingTimeLabel(castingTime: SpellRowView["castingTime"]): string {
  const unit = LONG_CASTING_UNITS[castingTime.type];
  if (unit === undefined || castingTime.value === undefined) {
    return castingTimeBadge(castingTime.type).label;
  }
  return longCastingTimeRu(unit, castingTime.value);
}

export function castingTimePhrase(castingTime: SpellRowView["castingTime"]): string {
  const unit = LONG_CASTING_UNITS[castingTime.type];
  if (unit === undefined || castingTime.value === undefined) {
    return castingTimeLabel(castingTime);
  }
  return `Накладывать ${timeSpanAccusativeRu(unit, castingTime.value)}`;
}

export const COMPONENT_WORDS = { verbal: "голос", somatic: "жест", material: "материал" } as const;

const TURN_COST_DETAIL: Readonly<Record<string, string>> = {
  action: "Действие — в свой ход",
  bonus_action: "Бонусное действие — в свой ход",
  reaction: "Реакция — в ответ, вне своего хода",
};

function minutesInRounds(minutes: number): string {
  const rounds = minutes * ROUNDS_PER_MINUTE;
  return `${rounds} ${plural(rounds, ["раунд", "раунда", "раундов"])}`;
}

export function castingTimeDetail(castingTime: SpellRowView["castingTime"]): string {
  const turnCost = TURN_COST_DETAIL[castingTime.type];
  if (turnCost !== undefined) return turnCost;
  const label = castingTimeLabel(castingTime);
  if (castingTime.type === "minute" && castingTime.value !== undefined) {
    return `${label} — ${minutesInRounds(castingTime.value)}`;
  }
  return label;
}

export function durationDetail(duration: SpellRowView["duration"]): string {
  const label = durationLabel(duration);
  if (duration.type === "instant") return "Мгновенная — эффект сразу";
  if (duration.type === "rounds" && duration.value === 1) {
    return `${label} — до начала своего следующего хода`;
  }
  if (duration.type === "minutes" && duration.value !== undefined) {
    return `${label} — ${minutesInRounds(duration.value)}`;
  }
  return label;
}

export function levelLabel(level: number): string {
  return level === CANTRIP_LEVEL ? "Заговор" : `${level} уровень`;
}

export function levelChipLabel(level: number): string {
  return level === CANTRIP_LEVEL ? "Без ячейки" : `${level} ур.`;
}

export function slotCostLabel(spell: SpellRowView): string {
  if (spell.level === CANTRIP_LEVEL) return "Без ячейки";
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

const DURATION_UNITS: Record<string, TimeUnit | undefined> = {
  rounds: "round",
  minutes: "minute",
  hours: "hour",
};

export function durationPhrase(duration: SpellRowView["duration"]): string {
  if (duration.type === "instant") return "Мгновенный эффект";
  const unit = DURATION_UNITS[duration.type];
  if (unit === undefined || duration.value === undefined) return "Длительность особая";
  return `Держится ${timeSpanAccusativeRu(unit, duration.value)}`;
}

export function ritualOnlyBadge(
  spell: SpellRowView,
): { label: string; icon: string; tone: Tone } | null {
  if (spell.ritual && !spell.prepared) {
    return { label: "Ритуал", icon: TONE_GLYPH.ritual, tone: "ritual" };
  }
  return null;
}

const SAVING_THROWS_SHORT: Readonly<Record<string, string>> = SAVING_THROW_SHORT;

export const COMPONENT_LETTERS = { verbal: "Г", somatic: "Ж", material: "М" } as const;

export function componentLetters(spell: SpellRowView): string {
  const { verbal, somatic, material } = spell.card.components;
  const letters = [
    ...(verbal ? [COMPONENT_LETTERS.verbal] : []),
    ...(somatic ? [COMPONENT_LETTERS.somatic] : []),
    ...(material === undefined || spell.materialCoveredByFocus ? [] : [COMPONENT_LETTERS.material]),
  ];
  return letters.join("·");
}

export function castTypePhrase(castingTime: SpellRowView["castingTime"]): string {
  if (castingTime.type === "bonus_action") return "Бонусное действие";
  return castingTimeLabel(castingTime);
}

export function castCostPhrase(spell: SpellRowView): string {
  const material = spell.card.components.material;
  const extra =
    spell.listCard?.costMaterialRu !== undefined && material?.costGp !== undefined
      ? ` + ${spell.listCard.costMaterialRu} ${material.costGp} ${CURRENCY_ABBREVIATIONS.gold}`
      : "";
  const ritual = `${TONE_GLYPH.ritual} ритуал`;
  if (spell.ritual && !spell.prepared) return ritual;
  if (spell.cantrip || spell.slotPrice === 0) return spell.ritualAvailable ? ritual : "бесплатно";
  const slot = spell.benefitsFromHigherSlot
    ? `ячейка от ${spell.slotPrice} ↑`
    : `ячейка ${spell.slotPrice}`;
  if (spell.ritualAvailable) return `${slot} или ${ritual}`;
  return `${slot}${extra}`;
}

export function holdsPhrase(spell: SpellRowView): { text: string; tone: Tone | null } | null {
  const { duration, concentration } = spell;
  if (duration.type === "instant") return null;
  const text = duration.type === "special" ? "пока не рассеют" : durationLabel(duration);
  return concentration
    ? { text: `${TONE_GLYPH.concentration} ${text}`, tone: "concentration" }
    : { text, tone: null };
}

export function rollPhrase(spell: SpellRowView, casting: CastingView): string | null {
  const { resolution } = spell;
  switch (resolution.type) {
    case "spell_attack":
      return `Атака ${CHECK_DIE_RU}${signed(casting.spellAttackModifier)} по КД цели`;
    case "saving_throw": {
      const subject = spell.listCard?.rollSubjectRu ?? "Цель";
      const short = resolution.savingThrow === undefined ? undefined : SAVING_THROWS_SHORT[resolution.savingThrow];
      const named = short === undefined ? "спасбросок" : `спас ${short}`;
      return `${subject} бросает ${named} против КС ${casting.spellSaveDc}`;
    }
    default:
      return null;
  }
}
