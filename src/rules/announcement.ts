/**
 * Объявление мастеру (FR-040, FR-041).
 *
 * Шаблон хранится в карточке заклинания, подстановки берутся из состояния персонажа и выбора в
 * мастере применения. Художественного текста здесь нет и быть не может: словарь подстановок закрыт
 * (FR-042, ADR-0005), а сама функция ничего не сочиняет.
 *
 * Чего приложение не заполняет, оно не выдумывает: неизвестная подстановка превращается в «?» и
 * попадает в `gaps` с причиной. Показать неверное число хуже, чем не показать никакого (OQ-11).
 */

import type { CharacterState } from "@/data/schemas/character";
import type { Spell } from "@/data/schemas/spell";
import { ANNOUNCEMENT_PLACEHOLDERS } from "@/data/schemas/spell";
import type { PaymentChoice } from "./availability";
import { spellPointCost } from "./bloodMagic";
import { effectiveDamage } from "./scaling";
import type { CastMode } from "./slots";

export type AnnouncementPlaceholder = (typeof ANNOUNCEMENT_PLACEHOLDERS)[number];

/** Незаполненная подстановка либо замечание о режиме применения. Причина — словами. */
export type AnnouncementGap = {
  placeholder?: AnnouncementPlaceholder;
  reasonRu: string;
};

export type Announcement = {
  /** Готовая к произнесению вслух формулировка. */
  text: string;
  gaps: AnnouncementGap[];
};

export type AnnouncementContext = {
  character: CharacterState;
  mode: CastMode;
  payment: PaymentChoice;
  /** Цель свободным текстом: модели противников в MVP нет (OQ-10). */
  targetLabel?: string;
};

/** Знак обязателен: игрок называет «плюс восемь», а не «восемь». */
function signed(value: number): string {
  return value < 0 ? `${value}` : `+${value}`;
}

/** Уровень, на котором сотворяется заклинание: выбранная ячейка или собственный уровень. */
function castLevel(spell: Spell, payment: PaymentChoice): number {
  return payment.kind === "slot" ? payment.slotLevel : spell.level;
}

type Resolved = { value: string; gap?: AnnouncementGap };

const UNKNOWN = "?";

function resolve(
  placeholder: AnnouncementPlaceholder,
  spell: Spell,
  context: AnnouncementContext,
): Resolved {
  const { character } = context;

  switch (placeholder) {
    case "slotLevel":
      return { value: `${castLevel(spell, context.payment)}` };

    case "spellSaveDc":
      return { value: `${character.spellSaveDc}` };

    case "spellAttackModifier":
      return { value: signed(character.spellAttackModifier) };

    case "damage":
      if (spell.damage === undefined) {
        return {
          value: UNKNOWN,
          gap: { placeholder, reasonRu: "У заклинания нет формулы урона" },
        };
      }
      return {
        value: effectiveDamage(spell.damage, {
          spellLevel: spell.level,
          slotLevel: castLevel(spell, context.payment),
          characterLevel: character.level,
        }),
      };

    case "target":
      // Пустая подстановка намеренно: «по цели в пределах 60 футов» звучит правильно и без цели.
      if (context.targetLabel === undefined) {
        return { value: "", gap: { placeholder, reasonRu: "Цель не указана" } };
      }
      return { value: context.targetLabel };

    case "range":
      if (spell.range.distanceFeet === undefined) {
        return {
          value: UNKNOWN,
          gap: { placeholder, reasonRu: "У заклинания нет дальности в футах" },
        };
      }
      return { value: `${spell.range.distanceFeet}` };

    case "armorClass":
      // КД с учётом заклинания складывается из активных эффектов и предметов: пока не считается.
      return {
        value: UNKNOWN,
        gap: {
          placeholder,
          reasonRu: "Готовый КД с учётом заклинания приложение пока не считает (FR-062, OQ-02)",
        },
      };
  }
}

/**
 * Замечание о режиме: у заклинания один шаблон, а режимов два. Ритуальные карточки написаны под
 * ритуал, поэтому обычное сотворение такого заклинания приложение проговаривает отдельно, а не
 * подменяет текст догадкой.
 */
function modeGap(spell: Spell, mode: CastMode): AnnouncementGap[] {
  if (!spell.ritual || mode === "ritual") return [];
  return [
    {
      reasonRu:
        "Шаблон написан для ритуального применения: при обычном сотворении назовите" +
        " израсходованную ячейку и время накладывания без 10 минут ритуала",
    },
  ];
}

/** Оплата кровью в шаблонах не предусмотрена: она добавляется фразой, а не подстановкой (F-15). */
function paymentSentence(spell: Spell, payment: PaymentChoice): string {
  if (payment.kind !== "spell_points") return "";
  return ` Ячейка не расходуется: сотворяю за очки заклинаний (${spellPointCost(spell.level)}).`;
}

/**
 * Готовое объявление. Порядок замечаний: сначала подстановки в порядке словаря, затем режим —
 * так список читается как «чего не хватает в тексте» сверху вниз.
 */
export function renderAnnouncement(spell: Spell, context: AnnouncementContext): Announcement {
  let text = spell.announcementTemplate;
  const gaps: AnnouncementGap[] = [];

  for (const placeholder of ANNOUNCEMENT_PLACEHOLDERS) {
    const token = `{${placeholder}}`;
    if (!text.includes(token)) continue;

    const { value, gap } = resolve(placeholder, spell, context);
    text = text.replaceAll(token, value);
    if (gap !== undefined) gaps.push(gap);
  }

  // Пустая подстановка цели оставляет двойной пробел — он виден на экране и слышен в паузе.
  text = `${text.replace(/ {2,}/g, " ").trim()}${paymentSentence(spell, context.payment)}`;

  return { text, gaps: [...gaps, ...modeGap(spell, context.mode)] };
}
